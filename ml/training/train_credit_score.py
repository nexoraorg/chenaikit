#!/usr/bin/env python3
"""
Credit Scoring Model Training Script
Trains machine learning models to predict credit scores based on blockchain transaction data
"""

import pandas as pd
import numpy as np
import yaml
import joblib
import mlflow
import mlflow.sklearn
from pathlib import Path
from typing import Dict, Any
import warnings
warnings.filterwarnings('ignore')

# ML models
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.svm import SVR
from sklearn.model_selection import cross_val_score, GridSearchCV
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

# Neural networks
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

# Import preprocessing
import sys
sys.path.append(str(Path(__file__).parent.parent / 'data'))
from preprocessing import DataPreprocessor

class CreditScoreTrainer:
    """Trainer for credit scoring models"""
    
    def __init__(self, config_path: str = "config/ml_config.yaml"):
        """Initialize trainer with configuration"""
        self.config = self._load_config(config_path)
        self.preprocessor = DataPreprocessor(config_path)
        self.models = {}
        self.best_model = None
        self.model_performance = {}
        
        # Set up MLflow
        mlflow.set_experiment(self.config['experiment_tracking']['experiment_name'])
        
    def _load_config(self, config_path: str) -> Dict:
        """Load ML configuration"""
        config_file = Path(__file__).parent.parent / config_path
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
    
    def load_and_preprocess_data(self) -> Dict:
        """Load and preprocess training data"""
        print("Loading and preprocessing data...")
        
        # Use preprocessor to prepare data
        data = self.preprocessor.preprocess_for_model('train_transactions.csv', 'credit_scoring')
        
        print(f"Training data shape: {data['X_train'].shape}")
        print(f"Test data shape: {data['X_test'].shape}")
        print(f"Target range: {data['y_train'].min():.1f} - {data['y_train'].max():.1f}")
        
        return data
    
    def create_traditional_models(self) -> Dict[str, Any]:
        """Create traditional ML models for credit scoring"""
        models = {}
        
        # Gradient Boosting (primary model)
        gb_params = self.config['models']['credit_scoring']['hyperparameters']
        models['gradient_boosting'] = GradientBoostingRegressor(**gb_params)
        
        # Random Forest
        rf_params = self.config['models']['credit_scoring']['hyperparameters'].copy()
        rf_params['n_estimators'] = 100
        models['random_forest'] = RandomForestRegressor(**rf_params)
        
        # Linear models
        models['linear_regression'] = LinearRegression()
        models['ridge'] = Ridge(alpha=1.0)
        models['lasso'] = Lasso(alpha=0.1)
        
        # Support Vector Regression
        models['svr'] = SVR(kernel='rbf', C=1.0, gamma='scale')
        
        return models
    
    def create_neural_network(self, input_shape: int) -> tf.keras.Model:
        """Create neural network model for credit scoring"""
        model = Sequential([
            Dense(128, activation='relu', input_shape=(input_shape,)),
            BatchNormalization(),
            Dropout(0.3),
            
            Dense(64, activation='relu'),
            BatchNormalization(),
            Dropout(0.2),
            
            Dense(32, activation='relu'),
            BatchNormalization(),
            Dropout(0.1),
            
            Dense(16, activation='relu'),
            Dense(1, activation='linear')  # Regression output
        ])
        
        # Compile model
        model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def train_traditional_models(self, X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series) -> Dict[str, Dict]:
        """Train traditional ML models"""
        print("Training traditional ML models...")
        
        models = self.create_traditional_models()
        results = {}
        
        for name, model in models.items():
            print(f"Training {name}...")
            
            with mlflow.start_run(run_name=f"credit_scoring_{name}"):
                # Train model
                model.fit(X_train, y_train)
                
                # Make predictions
                y_train_pred = model.predict(X_train)
                y_test_pred = model.predict(X_test)
                
                # Calculate metrics
                train_metrics = self.calculate_regression_metrics(y_train, y_train_pred)
                test_metrics = self.calculate_regression_metrics(y_test, y_test_pred)
                
                # Cross-validation
                cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='neg_mean_squared_error')
                cv_rmse = np.sqrt(-cv_scores.mean())
                
                # Log metrics to MLflow
                mlflow.log_metrics({
                    f'train_mse': train_metrics['mse'],
                    f'test_mse': test_metrics['mse'],
                    f'train_mae': train_metrics['mae'],
                    f'test_mae': test_metrics['mae'],
                    f'train_r2': train_metrics['r2'],
                    f'test_r2': test_metrics['r2'],
                    f'cv_rmse': cv_rmse
                })
                
                # Log model
                mlflow.sklearn.log_model(model, f"model_{name}")
                
                # Log parameters
                if hasattr(model, 'get_params'):
                    mlflow.log_params(model.get_params())
                
                results[name] = {
                    'model': model,
                    'train_metrics': train_metrics,
                    'test_metrics': test_metrics,
                    'cv_rmse': cv_rmse
                }
                
                print(f"{name} - Test RMSE: {np.sqrt(test_metrics['mse']):.3f}, Test R²: {test_metrics['r2']:.3f}")
        
        return results
    
    def train_neural_network(self, X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, y_test: pd.Series) -> Dict:
        """Train neural network model"""
        print("Training neural network...")
        
        with mlflow.start_run(run_name="credit_scoring_neural_network"):
            # Create model
            model = self.create_neural_network(X_train.shape[1])
            
            # Callbacks
            early_stopping = EarlyStopping(
                monitor='val_loss',
                patience=self.config['training']['early_stopping_patience'],
                restore_best_weights=True
            )
            
            reduce_lr = ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-6
            )
            
            # Train model
            history = model.fit(
                X_train, y_train,
                validation_data=(X_test, y_test),
                epochs=self.config['training']['epochs'],
                batch_size=self.config['training']['batch_size'],
                callbacks=[early_stopping, reduce_lr],
                verbose=1
            )
            
            # Make predictions
            y_train_pred = model.predict(X_train).flatten()
            y_test_pred = model.predict(X_test).flatten()
            
            # Calculate metrics
            train_metrics = self.calculate_regression_metrics(y_train, y_train_pred)
            test_metrics = self.calculate_regression_metrics(y_test, y_test_pred)
            
            # Log metrics
            mlflow.log_metrics({
                'train_mse': train_metrics['mse'],
                'test_mse': test_metrics['mse'],
                'train_mae': train_metrics['mae'],
                'test_mae': test_metrics['mae'],
                'train_r2': train_metrics['r2'],
                'test_r2': test_metrics['r2']
            })
            
            # Log model
            mlflow.keras.log_model(model, "neural_network_model")
            
            # Log training history
            for epoch, loss in enumerate(history.history['loss']):
                mlflow.log_metric(f'train_loss_epoch_{epoch}', loss)
            
            print(f"Neural Network - Test RMSE: {np.sqrt(test_metrics['mse']):.3f}, Test R²: {test_metrics['r2']:.3f}")
            
            return {
                'model': model,
                'train_metrics': train_metrics,
                'test_metrics': test_metrics,
                'history': history.history
            }
    
    def calculate_regression_metrics(self, y_true: pd.Series, y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate regression metrics"""
        return {
            'mse': mean_squared_error(y_true, y_pred),
            'mae': mean_absolute_error(y_true, y_pred),
            'r2': r2_score(y_true, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_true, y_pred))
        }
    
    def hyperparameter_tuning(self, X_train: pd.DataFrame, y_train: pd.Series) -> Dict:
        """Perform hyperparameter tuning for best model"""
        print("Performing hyperparameter tuning...")
        
        # Use Gradient Boosting as base model
        base_model = GradientBoostingRegressor(random_state=self.config['training']['random_state'])
        
        # Parameter grid
        param_grid = {
            'n_estimators': [100, 200, 300],
            'max_depth': [6, 8, 10],
            'learning_rate': [0.05, 0.1, 0.2],
            'subsample': [0.8, 0.9, 1.0]
        }
        
        # Grid search
        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=5,
            scoring='neg_mean_squared_error',
            n_jobs=-1,
            verbose=1
        )
        
        grid_search.fit(X_train, y_train)
        
        print(f"Best parameters: {grid_search.best_params_}")
        print(f"Best CV score: {np.sqrt(-grid_search.best_score_):.3f}")
        
        return grid_search
    
    def select_best_model(self, results: Dict) -> str:
        """Select best model based on test performance"""
        best_model_name = None
        best_score = float('inf')
        
        for name, result in results.items():
            test_rmse = np.sqrt(result['test_metrics']['mse'])
            if test_rmse < best_score:
                best_score = test_rmse
                best_model_name = name
        
        print(f"Best model: {best_model_name} (RMSE: {best_score:.3f})")
        return best_model_name
    
    def save_model(self, model: Any, model_name: str, save_path: str = None):
        """Save trained model"""
        if save_path is None:
            save_path = f"../models/credit_scoring_{model_name}.pkl"
        
        save_file = Path(__file__).parent.parent / save_path
        joblib.dump(model, save_file)
        print(f"Model saved to {save_file}")
    
    def save_model_as_onnx(self, model: Any, model_name: str, X_sample: pd.DataFrame):
        """Save model in ONNX format"""
        try:
            import onnx
            import onnxruntime as ort
            from skl2onnx import convert_sklearn
            from skl2onnx.common.data_types import FloatTensorType
            
            # Convert to ONNX
            initial_type = [('float_input', FloatTensorType([None, X_sample.shape[1]]))]
            onnx_model = convert_sklearn(model, initial_types=initial_type)
            
            # Save ONNX model
            onnx_path = Path(__file__).parent.parent / f"../models/credit_scoring_{model_name}.onnx"
            with open(onnx_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
            
            print(f"ONNX model saved to {onnx_path}")
            
            # Test ONNX model
            ort_session = ort.InferenceSession(onnx_path)
            input_name = ort_session.get_inputs()[0].name
            result = ort_session.run(None, {input_name: X_sample.iloc[:1].values.astype(np.float32)})
            print(f"ONNX model test prediction: {result[0][0]:.2f}")
            
        except ImportError:
            print("ONNX conversion packages not installed. Skipping ONNX export.")
    
    def train(self):
        """Main training pipeline"""
        print("Starting credit scoring model training...")
        
        # Load and preprocess data
        data = self.load_and_preprocess_data()
        
        # Train traditional models
        traditional_results = self.train_traditional_models(
            data['X_train'], data['y_train'], 
            data['X_test'], data['y_test']
        )
        
        # Train neural network
        nn_results = self.train_neural_network(
            data['X_train'], data['y_train'],
            data['X_test'], data['y_test']
        )
        
        # Combine results
        all_results = {**traditional_results, 'neural_network': nn_results}
        
        # Select best model
        best_model_name = self.select_best_model(all_results)
        self.best_model = all_results[best_model_name]['model']
        self.model_performance = all_results
        
        # Save best model
        self.save_model(self.best_model, best_model_name)
        
        # Save as ONNX
        if best_model_name != 'neural_network':
            self.save_model_as_onnx(self.best_model, best_model_name, data['X_test'])
        
        # Save preprocessors
        self.preprocessor.save_preprocessors('credit_preprocessors.pkl')
        
        print("Credit scoring model training completed!")
        return all_results

def main():
    """Main function"""
    trainer = CreditScoreTrainer()
    results = trainer.train()
    
    # Print summary
    print("\n=== Model Performance Summary ===")
    for name, result in results.items():
        test_rmse = np.sqrt(result['test_metrics']['mse'])
        test_r2 = result['test_metrics']['r2']
        print(f"{name}: RMSE={test_rmse:.3f}, R²={test_r2:.3f}")

if __name__ == "__main__":
    main()
