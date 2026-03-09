#!/usr/bin/env python3
"""
Data Preprocessing Pipeline for Blockchain Transaction Data
Handles cleaning, feature engineering, and preparation for ML models
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, RobustScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
import yaml
from pathlib import Path
from typing import Dict, Tuple, List
import warnings
warnings.filterwarnings('ignore')

class DataPreprocessor:
    """Data preprocessing pipeline for blockchain transaction ML"""
    
    def __init__(self, config_path: str = "config/ml_config.yaml"):
        """Initialize preprocessor with configuration"""
        self.config = self._load_config(config_path)
        self.scalers = {}
        self.encoders = {}
        self.feature_columns = []
        self.target_columns = {}
        
    def _load_config(self, config_path: str) -> Dict:
        """Load ML configuration"""
        config_file = Path(__file__).parent.parent / config_path
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
    
    def load_data(self, file_path: str) -> pd.DataFrame:
        """Load data from CSV file"""
        data_path = Path(__file__).parent / file_path
        df = pd.read_csv(data_path)
        
        # Convert timestamp column
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        print(f"Loaded data: {len(df)} rows, {len(df.columns)} columns")
        return df
    
    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and validate data"""
        print("Cleaning data...")
        
        # Remove duplicates
        initial_rows = len(df)
        df = df.drop_duplicates(subset=['transaction_hash'], keep='first')
        print(f"Removed {initial_rows - len(df)} duplicate transactions")
        
        # Handle missing values
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        categorical_columns = df.select_dtypes(include=['object']).columns
        
        # Impute missing numeric values
        if len(numeric_columns) > 0:
            numeric_imputer = SimpleImputer(strategy='median')
            df[numeric_columns] = numeric_imputer.fit_transform(df[numeric_columns])
        
        # Impute missing categorical values
        if len(categorical_columns) > 0:
            categorical_imputer = SimpleImputer(strategy='most_frequent')
            df[categorical_columns] = categorical_imputer.fit_transform(df[categorical_columns])
        
        # Remove outliers using IQR method for key numeric columns
        key_numeric_cols = ['amount', 'gas_used', 'gas_cost', 'sender_balance_before', 'receiver_balance_before']
        for col in key_numeric_cols:
            if col in df.columns:
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                # Cap outliers instead of removing them
                df[col] = df[col].clip(lower_bound, upper_bound)
        
        # Validate data ranges
        if 'amount' in df.columns:
            df = df[df['amount'] > 0]  # Remove zero/negative amounts
        
        if 'sender_credit_score' in df.columns:
            df = df[(df['sender_credit_score'] >= 300) & (df['sender_credit_score'] <= 850)]
        
        print(f"Data cleaned: {len(df)} rows remaining")
        return df
    
    def encode_categorical_features(self, df: pd.DataFrame, fit: bool = True) -> pd.DataFrame:
        """Encode categorical features"""
        print("Encoding categorical features...")
        
        categorical_columns = ['transaction_type', 'sender_address', 'receiver_address']
        categorical_columns = [col for col in categorical_columns if col in df.columns]
        
        for col in categorical_columns:
            if fit:
                self.encoders[col] = LabelEncoder()
                # Handle unseen labels by fitting on all possible values
                df[col] = self.encoders[col].fit_transform(df[col].astype(str))
            else:
                # Transform using fitted encoder, handling unseen labels
                if col in self.encoders:
                    # Create a mapping for unseen values
                    known_classes = set(self.encoders[col].classes_)
                    df[col] = df[col].astype(str).map(
                        lambda x: x if x in known_classes else self.encoders[col].classes_[0]
                    )
                    df[col] = self.encoders[col].transform(df[col])
        
        return df
    
    def scale_features(self, df: pd.DataFrame, fit: bool = True) -> pd.DataFrame:
        """Scale numerical features"""
        print("Scaling features...")
        
        # Identify numerical columns (excluding targets and IDs)
        exclude_columns = ['is_fraud', 'sender_credit_score', 'transaction_hash', 'timestamp']
        numerical_columns = df.select_dtypes(include=[np.number]).columns
        numerical_columns = [col for col in numerical_columns if col not in exclude_columns]
        
        if len(numerical_columns) > 0:
            if fit:
                # Use RobustScaler for features with outliers
                self.scalers['robust'] = RobustScaler()
                df[numerical_columns] = self.scalers['robust'].fit_transform(df[numerical_columns])
            else:
                if 'robust' in self.scalers:
                    df[numerical_columns] = self.scalers['robust'].transform(df[numerical_columns])
        
        return df
    
    def select_features(self, df: pd.DataFrame, model_type: str) -> Tuple[pd.DataFrame, pd.Series]:
        """Select features for specific model type"""
        print(f"Selecting features for {model_type} model...")
        
        if model_type == 'credit_scoring':
            # Features for credit scoring
            feature_cols = [
                'amount', 'amount_log', 'sender_tx_count', 'sender_avg_amount', 
                'sender_std_amount', 'sender_account_age_days', 'sender_tx_frequency',
                'time_since_last_tx_hours', 'balance_change_ratio', 'volatility_score',
                'hour_of_day', 'day_of_week', 'is_weekend', 'gas_used', 'gas_cost'
            ]
            target_col = 'sender_credit_score'
            
        elif model_type == 'fraud_detection':
            # Features for fraud detection
            feature_cols = [
                'amount', 'amount_zscore', 'amount_log', 'gas_used', 'gas_cost', 
                'gas_anomaly_score', 'sender_tx_count', 'sender_avg_amount',
                'time_since_last_tx_hours', 'rapid_tx_count', 'balance_change_ratio',
                'unusual_counterparty', 'hour_of_day', 'day_of_week', 'is_weekend',
                'sender_is_contract', 'receiver_is_contract', 'transaction_type'
            ]
            target_col = 'is_fraud'
            
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Filter to available columns
        available_features = [col for col in feature_cols if col in df.columns]
        self.feature_columns = available_features
        self.target_columns[model_type] = target_col
        
        X = df[available_features].copy()
        y = df[target_col].copy()
        
        print(f"Selected {len(available_features)} features")
        print(f"Feature columns: {available_features}")
        
        return X, y
    
    def handle_class_imbalance(self, X: pd.DataFrame, y: pd.Series, method: str = 'smote') -> Tuple[pd.DataFrame, pd.Series]:
        """Handle class imbalance for fraud detection"""
        if method == 'smote':
            try:
                from imblearn.over_sampling import SMOTE
                smote = SMOTE(random_state=self.config['training']['random_state'])
                X_resampled, y_resampled = smote.fit_resample(X, y)
                print(f"Applied SMOTE: {len(X)} -> {len(X_resampled)} samples")
                return pd.DataFrame(X_resampled, columns=X.columns), pd.Series(y_resampled)
            except ImportError:
                print("imbalanced-learn not installed, using random undersampling")
                method = 'undersample'
        
        if method == 'undersample':
            # Random undersampling for majority class
            from sklearn.utils import resample
            
            df_combined = pd.concat([X, y], axis=1)
            df_majority = df_combined[df_combined[y.name] == 0]
            df_minority = df_combined[df_combined[y.name] == 1]
            
            # Undersample majority class
            df_majority_undersampled = resample(df_majority, 
                                             replace=False,
                                             n_samples=len(df_minority) * 2,  # 2:1 ratio
                                             random_state=self.config['training']['random_state'])
            
            df_balanced = pd.concat([df_majority_undersampled, df_minority])
            X_balanced = df_balanced.drop(columns=[y.name])
            y_balanced = df_balanced[y.name]
            
            print(f"Applied undersampling: {len(X)} -> {len(X_balanced)} samples")
            return X_balanced, y_balanced
        
        return X, y
    
    def create_time_series_split(self, X: pd.DataFrame, y: pd.Series, test_size: float = 0.2) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
        """Create time-based train/test split"""
        # Use temporal split if timestamp is available
        if 'timestamp' in X.columns:
            X_sorted = X.sort_values('timestamp')
            y_sorted = y.loc[X_sorted.index]
            
            split_idx = int(len(X_sorted) * (1 - test_size))
            X_train, X_test = X_sorted.iloc[:split_idx], X_sorted.iloc[split_idx:]
            y_train, y_test = y_sorted.iloc[:split_idx], y_sorted.iloc[split_idx:]
        else:
            # Regular random split
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=self.config['training']['random_state'],
                stratify=y if y.nunique() < 10 else None
            )
        
        print(f"Train set: {len(X_train)} samples")
        print(f"Test set: {len(X_test)} samples")
        
        return X_train, X_test, y_train, y_test
    
    def preprocess_for_model(self, file_path: str, model_type: str, handle_imbalance: bool = False) -> Dict:
        """Complete preprocessing pipeline for specific model"""
        print(f"Preprocessing data for {model_type} model...")
        
        # Load and clean data
        df = self.load_data(file_path)
        df = self.clean_data(df)
        
        # Encode and scale
        df = self.encode_categorical_features(df, fit=True)
        df = self.scale_features(df, fit=True)
        
        # Select features
        X, y = self.select_features(df, model_type)
        
        # Handle class imbalance for fraud detection
        if handle_imbalance and model_type == 'fraud_detection':
            X, y = self.handle_class_imbalance(X, y)
        
        # Create train/test split
        X_train, X_test, y_train, y_test = self.create_time_series_split(
            X, y, self.config['training']['test_size']
        )
        
        return {
            'X_train': X_train,
            'X_test': X_test,
            'y_train': y_train,
            'y_test': y_test,
            'feature_columns': self.feature_columns,
            'target_column': self.target_columns[model_type]
        }
    
    def transform_new_data(self, df: pd.DataFrame, model_type: str) -> pd.DataFrame:
        """Transform new data using fitted preprocessors"""
        df = df.copy()
        
        # Apply same preprocessing steps
        df = self.encode_categorical_features(df, fit=False)
        df = self.scale_features(df, fit=False)
        
        # Select features
        feature_cols = self.feature_columns if self.feature_columns else self.config['data']['features'][f'{model_type}_features']
        available_features = [col for col in feature_cols if col in df.columns]
        
        return df[available_features]
    
    def save_preprocessors(self, save_path: str):
        """Save fitted preprocessors"""
        import joblib
        
        preprocessors = {
            'scalers': self.scalers,
            'encoders': self.encoders,
            'feature_columns': self.feature_columns,
            'target_columns': self.target_columns
        }
        
        save_file = Path(__file__).parent / save_path
        joblib.dump(preprocessors, save_file)
        print(f"Preprocessors saved to {save_file}")
    
    def load_preprocessors(self, load_path: str):
        """Load fitted preprocessors"""
        import joblib
        
        load_file = Path(__file__).parent / load_path
        preprocessors = joblib.load(load_file)
        
        self.scalers = preprocessors['scalers']
        self.encoders = preprocessors['encoders']
        self.feature_columns = preprocessors['feature_columns']
        self.target_columns = preprocessors['target_columns']
        
        print(f"Preprocessors loaded from {load_file}")

def main():
    """Main function to run preprocessing pipeline"""
    preprocessor = DataPreprocessor()
    
    # Preprocess for credit scoring
    credit_data = preprocessor.preprocess_for_model('train_transactions.csv', 'credit_scoring')
    preprocessor.save_preprocessors('credit_preprocessors.pkl')
    
    # Preprocess for fraud detection
    fraud_data = preprocessor.preprocess_for_model('train_transactions.csv', 'fraud_detection', handle_imbalance=True)
    preprocessor.save_preprocessors('fraud_preprocessors.pkl')
    
    print("Data preprocessing completed!")

if __name__ == "__main__":
    main()
