#!/usr/bin/env python3
"""
Fraud Detection Model Training Script
Trains machine learning models to detect fraudulent blockchain transactions
"""

import pandas as pd
import numpy as np
import yaml
import joblib
import mlflow
import mlflow.sklearn
from pathlib import Path
from typing import Dict, Any, Tuple
import warnings
warnings.filterwarnings('ignore')

# ML models
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import LocalOutlierFactor

# Neural networks
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

# Metrics and evaluation
from sklearn.model_selection import cross_val_score, GridSearchCV, StratifiedKFold
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score, 
                           roc_auc_score, confusion_matrix, classification_report,
                           precision_recall_curve, average_precision_score)

# Import preprocessing
import sys
sys.path.append(str(Path(__file__).parent.parent / 'data'))
from preprocessing import DataPreprocessor

class FraudDetectionTrainer:
    """Trainer for fraud detection models"""
    
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
        
        # Use preprocessor to prepare data with class imbalance handling
        data = self.preprocessor.preprocess_for_model('train_transactions.csv', 'fraud_detection', handle_imbalance=True)
        
        print(f"Training data shape: {data['X_train'].shape}")
        print(f"Test data shape: {data['X_test'].shape}")
        print(f"Fraud ratio in train: {data['y_train'].mean():.4f}")
        print(f"Fraud ratio in test: {data['y_test'].mean():.4f}")
        
        return data
    
    def create_classification_models(self) -> Dict[str, Any]:
        """Create classification models for fraud detection"""
        models = {}
        
        # Random Forest (primary model)
        rf_params = self.config['models']['fraud_detection']['hyperparameters']
        models['random_forest'] = RandomForestClassifier(**rf_params, class_weight='balanced')
        
        # Gradient Boosting
        gb_params = self.config['models']['fraud_detection']['hyperparameters'].copy()
        models['gradient_boosting'] = GradientBoostingClassifier(**gb_params)
        
        # Logistic Regression
        models['logistic_regression'] = LogisticRegression(
            random_state=self.config['training']['random_state'],
            class_weight='balanced',
            max_iter=1000
        )
        
        # Support Vector Machine
        models['svm'] = SVC(
            probability=True,
            random_state=self.config['training']['random_state'],
            class_weight='balanced'
        )
        
        # Decision Tree
        models['decision_tree'] = DecisionTreeClassifier(
            random_state=self.config['training']['random_state'],
            class_weight='balanced',
            max_depth=10
        )
        
        # Isolation Forest (unsupervised)
        models['isolation_forest'] = IsolationForest(
            random_state=self.config['training']['random_state'],
            contamination=0.1
        )
        
        return models
    
    def create_neural_network(self, input_shape: int) -> tf.keras.Model:
        """Create neural network model for fraud detection"""
        model = Sequential([
            Dense(128, activation='relu', input_shape=(input_shape,)),
            BatchNormalization(),
            Dropout(0.4),
            
            Dense(64, activation='relu'),
            BatchNormalization(),
            Dropout(0.3),
            
            Dense(32, activation='relu'),
            BatchNormalization(),
            Dropout(0.2),
            
            Dense(16, activation='relu'),
            Dropout(0.1),
            
            Dense(1, activation='sigmoid')  # Binary classification
        ])
        
        # Compile model with class weights consideration
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        return model
    
    def calculate_classification_metrics(self, y_true: pd.Series, y_pred: np.ndarray, y_proba: np.ndarray = None) -> Dict[str, float]:
        """Calculate classification metrics"""
        metrics = {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, average='binary'),
            'recall': recall_score(y_true, y_pred, average='binary'),
            'f1': f1_score(y_true, y_pred, average='binary'),
        }
        
        if y_proba is not None:
            metrics['roc_auc'] = roc_auc_score(y_true, y_proba)
            metrics['average_precision'] = average_precision_score(y_true, y_proba)
        
        return metrics
    
    def train_classification_models(self, X_train: pd.DataFrame, y_train: pd.Series, 
                                 X_test: pd.DataFrame, y_test: pd.Series) -> Dict[str, Dict]:
        """Train classification models"""
        print("Training classification models...")
        
        models = self.create_classification_models()
        results = {}
        
        for name, model in models.items():
            print(f"Training {name}...")
            
            with mlflow.start_run(run_name=f"fraud_detection_{name}"):
                try:
                    # Special handling for isolation forest
                    if name == 'isolation_forest':
                        # Isolation Forest returns -1 for outliers, 1 for inliers
                        model.fit(X_train)
                        y_train_pred = (model.predict(X_train) == -1).astype(int)
                        y_test_pred = (model.predict(X_test) == -1).astype(int)
                        y_train_proba = None
                        y_test_proba = None
                    else:
                        # Train supervised models
                        model.fit(X_train, y_train)
                        
                        # Make predictions
                        y_train_pred = model.predict(X_train)
                        y_test_pred = model.predict(X_test)
                        
                        # Get probabilities
                        if hasattr(model, 'predict_proba'):
                            y_train_proba = model.predict_proba(X_train)[:, 1]
                            y_test_proba = model.predict_proba(X_test)[:, 1]
                        else:
                            y_train_proba = None
                            y_test_proba = None
                    
                    # Calculate metrics
                    train_metrics = self.calculate_classification_metrics(y_train, y_train_pred, y_train_proba)
                    test_metrics = self.calculate_classification_metrics(y_test, y_test_pred, y_test_proba)
                    
                    # Cross-validation (skip for isolation forest)
                    if name != 'isolation_forest':
                        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=self.config['training']['random_state'])
                        cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='roc_auc')
                        cv_auc_mean = cv_scores.mean()
                        cv_auc_std = cv_scores.std()
                    else:
                        cv_auc_mean = 0
                        cv_auc_std = 0
                    
                    # Log metrics to MLflow
                    mlflow.log_metrics({
                        'train_accuracy': train_metrics['accuracy'],
                        'test_accuracy': test_metrics['accuracy'],
                        'train_precision': train_metrics['precision'],
                        'test_precision': test_metrics['precision'],
                        'train_recall': train_metrics['recall'],
                        'test_recall': test_metrics['recall'],
                        'train_f1': train_metrics['f1'],
                        'test_f1': test_metrics['f1'],
                        'cv_auc_mean': cv_auc_mean,
                        'cv_auc_std': cv_auc_std
                    })
                    
                    if y_test_proba is not None:
                        mlflow.log_metrics({
                            'train_roc_auc': train_metrics['roc_auc'],
                            'test_roc_auc': test_metrics['roc_auc'],
                            'train_avg_precision': train_metrics['average_precision'],
                            'test_avg_precision': test_metrics['average_precision']
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
                        'cv_auc_mean': cv_auc_mean,
                        'cv_auc_std': cv_auc_std
                    }
                    
                    print(f"{name} - Test F1: {test_metrics['f1']:.3f}, Test ROC-AUC: {test_metrics.get('roc_auc', 0):.3f}")
                    
                except Exception as e:
                    print(f"Error training {name}: {str(e)}")
                    continue
        
        return results
    
    def train_neural_network(self, X_train: pd.DataFrame, y_train: pd.Series, 
                           X_test: pd.DataFrame, y_test: pd.Series) -> Dict:
        """Train neural network model"""
        print("Training neural network...")
        
        with mlflow.start_run(run_name="fraud_detection_neural_network"):
            # Create model
            model = self.create_neural_network(X_train.shape[1])
            
            # Calculate class weights
            class_weights = {0: 1, 1: len(y_train) / sum(y_train) - 1}
            
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
                class_weight=class_weights,
                callbacks=[early_stopping, reduce_lr],
                verbose=1
            )
            
            # Make predictions
            y_train_proba = model.predict(X_train).flatten()
            y_test_proba = model.predict(X_test).flatten()
            
            # Convert probabilities to predictions
            threshold = self.config['evaluation']['threshold']
            y_train_pred = (y_train_proba >= threshold).astype(int)
            y_test_pred = (y_test_proba >= threshold).astype(int)
            
            # Calculate metrics
            train_metrics = self.calculate_classification_metrics(y_train, y_train_pred, y_train_proba)
            test_metrics = self.calculate_classification_metrics(y_test, y_test_pred, y_test_proba)
            
            # Log metrics
            mlflow.log_metrics({
                'train_accuracy': train_metrics['accuracy'],
                'test_accuracy': test_metrics['accuracy'],
                'train_precision': train_metrics['precision'],
                'test_precision': test_metrics['precision'],
                'train_recall': train_metrics['recall'],
                'test_recall': test_metrics['recall'],
                'train_f1': train_metrics['f1'],
                'test_f1': test_metrics['f1'],
                'train_roc_auc': train_metrics['roc_auc'],
                'test_roc_auc': test_metrics['roc_auc'],
                'train_avg_precision': train_metrics['average_precision'],
                'test_avg_precision': test_metrics['average_precision']
            })
            
            # Log model
            mlflow.keras.log_model(model, "neural_network_model")
            
            # Log training history
            for epoch, loss in enumerate(history.history['loss']):
                mlflow.log_metric(f'train_loss_epoch_{epoch}', loss)
            
            print(f"Neural Network - Test F1: {test_metrics['f1']:.3f}, Test ROC-AUC: {test_metrics['roc_auc']:.3f}")
            
            return {
                'model': model,
                'train_metrics': train_metrics,
                'test_metrics': test_metrics,
                'history': history.history
            }
    
    def find_optimal_threshold(self, y_true: pd.Series, y_proba: np.ndarray) -> float:
        """Find optimal threshold based on F1 score"""
        precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
        f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-8)
        
        optimal_idx = np.argmax(f1_scores)
        optimal_threshold = thresholds[optimal_idx]
        optimal_f1 = f1_scores[optimal_idx]
        
        print(f"Optimal threshold: {optimal_threshold:.3f} (F1: {optimal_f1:.3f})")
        return optimal_threshold
    
    def evaluate_model_detailed(self, model: Any, X_test: pd.DataFrame, y_test: pd.Series, model_name: str):
        """Detailed model evaluation"""
        print(f"\n=== Detailed Evaluation for {model_name} ===")
        
        # Make predictions
        if hasattr(model, 'predict_proba'):
            y_proba = model.predict_proba(X_test)[:, 1]
        elif hasattr(model, 'decision_function'):
            y_proba = model.decision_function(X_test)
            y_proba = (y_proba - y_proba.min()) / (y_proba.max() - y_proba.min())  # Normalize
        else:
            # For neural network or isolation forest
            if hasattr(model, 'predict'):
                y_pred = model.predict(X_test)
                if len(y_pred.shape) > 1:
                    y_proba = y_pred.flatten()
                else:
                    y_proba = y_pred
            else:
                y_proba = model.predict(X_test)
        
        # Find optimal threshold
        if model_name != 'isolation_forest':
            optimal_threshold = self.find_optimal_threshold(y_test, y_proba)
            y_pred_optimal = (y_proba >= optimal_threshold).astype(int)
        else:
            y_pred_optimal = y_proba
            optimal_threshold = 0.5
        
        # Classification report
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred_optimal))
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred_optimal)
        print(f"\nConfusion Matrix:")
        print(f"True Negatives: {cm[0,0]}, False Positives: {cm[0,1]}")
        print(f"False Negatives: {cm[1,0]}, True Positives: {cm[1,1]}")
        
        # Feature importance (for tree-based models)
        if hasattr(model, 'feature_importances_'):
            feature_importance = pd.DataFrame({
                'feature': X_test.columns,
                'importance': model.feature_importances_
            }).sort_values('importance', ascending=False)
            
            print(f"\nTop 10 Important Features:")
            print(feature_importance.head(10))
    
    def hyperparameter_tuning(self, X_train: pd.DataFrame, y_train: pd.Series) -> Dict:
        """Perform hyperparameter tuning for best model"""
        print("Performing hyperparameter tuning...")
        
        # Use Random Forest as base model
        base_model = RandomForestClassifier(
            random_state=self.config['training']['random_state'],
            class_weight='balanced'
        )
        
        # Parameter grid
        param_grid = {
            'n_estimators': [50, 100, 200],
            'max_depth': [10, 15, 20],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        }
        
        # Grid search with cross-validation
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=self.config['training']['random_state'])
        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=cv,
            scoring='roc_auc',
            n_jobs=-1,
            verbose=1
        )
        
        grid_search.fit(X_train, y_train)
        
        print(f"Best parameters: {grid_search.best_params_}")
        print(f"Best CV score: {grid_search.best_score_:.3f}")
        
        return grid_search
    
    def select_best_model(self, results: Dict) -> str:
        """Select best model based on test F1 score"""
        best_model_name = None
        best_score = 0
        
        for name, result in results.items():
            test_f1 = result['test_metrics']['f1']
            if test_f1 > best_score:
                best_score = test_f1
                best_model_name = name
        
        print(f"Best model: {best_model_name} (F1: {best_score:.3f})")
        return best_model_name
    
    def save_model(self, model: Any, model_name: str, save_path: str = None):
        """Save trained model"""
        if save_path is None:
            save_path = f"../models/fraud_detection_{model_name}.pkl"
        
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
            onnx_path = Path(__file__).parent.parent / f"../models/fraud_detection_{model_name}.onnx"
            with open(onnx_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
            
            print(f"ONNX model saved to {onnx_path}")
            
            # Test ONNX model
            ort_session = ort.InferenceSession(onnx_path)
            input_name = ort_session.get_inputs()[0].name
            result = ort_session.run(None, {input_name: X_sample.iloc[:1].values.astype(np.float32)})
            print(f"ONNX model test prediction: {result[0][0]:.4f}")
            
        except ImportError:
            print("ONNX conversion packages not installed. Skipping ONNX export.")
    
    def train(self):
        """Main training pipeline"""
        print("Starting fraud detection model training...")
        
        # Load and preprocess data
        data = self.load_and_preprocess_data()
        
        # Train classification models
        classification_results = self.train_classification_models(
            data['X_train'], data['y_train'],
            data['X_test'], data['y_test']
        )
        
        # Train neural network
        nn_results = self.train_neural_network(
            data['X_train'], data['y_train'],
            data['X_test'], data['y_test']
        )
        
        # Combine results
        all_results = {**classification_results, 'neural_network': nn_results}
        
        # Select best model
        best_model_name = self.select_best_model(all_results)
        self.best_model = all_results[best_model_name]['model']
        self.model_performance = all_results
        
        # Detailed evaluation of best model
        self.evaluate_model_detailed(
            self.best_model, data['X_test'], data['y_test'], best_model_name
        )
        
        # Save best model
        self.save_model(self.best_model, best_model_name)
        
        # Save as ONNX
        if best_model_name != 'neural_network':
            self.save_model_as_onnx(self.best_model, best_model_name, data['X_test'])
        
        # Save preprocessors
        self.preprocessor.save_preprocessors('fraud_preprocessors.pkl')
        
        print("Fraud detection model training completed!")
        return all_results

def main():
    """Main function"""
    trainer = FraudDetectionTrainer()
    results = trainer.train()
    
    # Print summary
    print("\n=== Model Performance Summary ===")
    for name, result in results.items():
        test_f1 = result['test_metrics']['f1']
        test_auc = result['test_metrics'].get('roc_auc', 0)
        print(f"{name}: F1={test_f1:.3f}, ROC-AUC={test_auc:.3f}")

if __name__ == "__main__":
    main()
