#!/usr/bin/env python3
"""
Synthetic Blockchain Transaction Data Generator
Generates realistic blockchain transaction data for ML model training
"""

import pandas as pd
import numpy as np
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import hashlib
import random
from pathlib import Path

class BlockchainDataGenerator:
    """Generate synthetic blockchain transaction data for ML training"""
    
    def __init__(self, config_path: str = "config/ml_config.yaml"):
        """Initialize with configuration"""
        self.config = self._load_config(config_path)
        self.accounts = self._generate_accounts()
        self.transactions = []
        
    def _load_config(self, config_path: str) -> Dict:
        """Load ML configuration"""
        config_file = Path(__file__).parent.parent / config_path
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
    
    def _generate_accounts(self) -> List[Dict]:
        """Generate synthetic blockchain accounts"""
        num_accounts = self.config['data']['synthetic']['num_transactions'] // 10
        accounts = []
        
        for i in range(num_accounts):
            account = {
                'address': f"0x{''.join(random.choices('0123456789abcdef', k=40))}",
                'balance': np.random.lognormal(10, 2),  # Log-normal distribution for balances
                'created_date': datetime.now() - timedelta(days=np.random.randint(1, 365)),
                'credit_score': np.random.randint(*self.config['data']['synthetic']['credit_score_range']),
                'is_fraudulent': np.random.random() < 0.05  # 5% of accounts are fraudulent
            }
            accounts.append(account)
        
        return accounts
    
    def _generate_transaction_hash(self) -> str:
        """Generate realistic transaction hash"""
        return f"0x{''.join(random.choices('0123456789abcdef', k=64))}"
    
    def _calculate_gas_price(self) -> float:
        """Calculate realistic gas price (in Gwei)"""
        base_gas = 20
        return base_gas + np.random.exponential(5)
    
    def _generate_transaction(self, timestamp: datetime) -> Dict:
        """Generate a single transaction"""
        sender = random.choice(self.accounts)
        receiver = random.choice([a for a in self.accounts if a['address'] != sender['address']])
        
        # Transaction amount based on sender's balance
        max_amount = min(sender['balance'] * 0.1, 
                        self.config['data']['synthetic']['transaction_amount_range'][1])
        amount = np.random.uniform(0.01, max_amount)
        
        # Gas calculation
        gas_used = np.random.randint(21000, 100000)
        gas_price = self._calculate_gas_price()
        
        # Determine if transaction is fraudulent
        is_fraud = self._determine_fraud(sender, receiver, amount, timestamp)
        
        transaction = {
            'transaction_hash': self._generate_transaction_hash(),
            'block_number': int(timestamp.timestamp() // 15),  # ~15 second blocks
            'timestamp': timestamp,
            'sender_address': sender['address'],
            'receiver_address': receiver['address'],
            'amount': amount,
            'gas_used': gas_used,
            'gas_price': gas_price,
            'gas_cost': gas_used * gas_price / 1e9,  # Convert to ETH
            'sender_balance_before': sender['balance'],
            'receiver_balance_before': receiver['balance'],
            'sender_credit_score': sender['credit_score'],
            'receiver_credit_score': receiver['credit_score'],
            'is_fraud': is_fraud,
            'transaction_type': self._determine_transaction_type(amount, sender, receiver),
            'sender_is_contract': np.random.random() < 0.3,
            'receiver_is_contract': np.random.random() < 0.3
        }
        
        # Update balances
        sender['balance'] -= (amount + transaction['gas_cost'])
        receiver['balance'] += amount
        
        return transaction
    
    def _determine_fraud(self, sender: Dict, receiver: Dict, amount: float, timestamp: datetime) -> bool:
        """Determine if transaction is fraudulent based on various factors"""
        fraud_probability = 0.0
        
        # High amount transactions
        if amount > sender['balance'] * 0.5:
            fraud_probability += 0.3
        
        # New accounts
        account_age = (timestamp - sender['created_date']).days
        if account_age < 7:
            fraud_probability += 0.2
        
        # Known fraudulent accounts
        if sender['is_fraudulent'] or receiver['is_fraudulent']:
            fraud_probability += 0.4
        
        # Unusual timing (middle of night)
        if timestamp.hour < 6 or timestamp.hour > 22:
            fraud_probability += 0.1
        
        # Rapid transactions (check if sender has recent transactions)
        recent_tx_count = sum(1 for tx in self.transactions[-10:] 
                            if tx['sender_address'] == sender['address'] and 
                            (timestamp - tx['timestamp']).total_seconds() < 300)
        if recent_tx_count > 3:
            fraud_probability += 0.2
        
        return np.random.random() < fraud_probability
    
    def _determine_transaction_type(self, amount: float, sender: Dict, receiver: Dict) -> str:
        """Determine transaction type based on characteristics"""
        if amount < 1:
            return 'micro'
        elif amount < 100:
            return 'small'
        elif amount < 10000:
            return 'medium'
        else:
            return 'large'
    
    def generate_dataset(self, num_transactions: int = None) -> pd.DataFrame:
        """Generate complete synthetic dataset"""
        if num_transactions is None:
            num_transactions = self.config['data']['synthetic']['num_transactions']
        
        print(f"Generating {num_transactions} synthetic transactions...")
        
        # Generate transactions over time
        start_date = datetime.now() - timedelta(days=self.config['data']['synthetic']['date_range_days'])
        
        for i in range(num_transactions):
            # Random timestamp within range
            random_days = np.random.randint(0, self.config['data']['synthetic']['date_range_days'])
            random_hours = np.random.randint(0, 24)
            random_minutes = np.random.randint(0, 60)
            timestamp = start_date + timedelta(days=random_days, hours=random_hours, minutes=random_minutes)
            
            transaction = self._generate_transaction(timestamp)
            self.transactions.append(transaction)
            
            if (i + 1) % 10000 == 0:
                print(f"Generated {i + 1} transactions...")
        
        df = pd.DataFrame(self.transactions)
        print(f"Dataset generated: {len(df)} transactions, {df['is_fraud'].sum()} fraudulent")
        print(f"Fraud ratio: {df['is_fraud'].mean():.4f}")
        
        return df
    
    def add_engineered_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add engineered features for ML models"""
        df = df.copy()
        
        # Time-based features
        df['hour_of_day'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Amount-based features
        df['amount_log'] = np.log1p(df['amount'])
        df['amount_zscore'] = (df['amount'] - df['amount'].mean()) / df['amount'].std()
        
        # Sender features
        sender_stats = df.groupby('sender_address').agg({
            'amount': ['count', 'mean', 'std', 'min', 'max'],
            'timestamp': ['min', 'max']
        }).fillna(0)
        
        sender_stats.columns = ['sender_tx_count', 'sender_avg_amount', 'sender_std_amount', 
                               'sender_min_amount', 'sender_max_amount', 'sender_first_tx', 'sender_last_tx']
        sender_stats['sender_account_age_days'] = (sender_stats['sender_last_tx'] - sender_stats['sender_first_tx']).dt.days
        sender_stats['sender_tx_frequency'] = sender_stats['sender_tx_count'] / (sender_stats['sender_account_age_days'] + 1)
        
        df = df.merge(sender_stats, left_on='sender_address', right_index=True, how='left')
        
        # Time since last transaction for sender
        df = df.sort_values(['sender_address', 'timestamp'])
        df['time_since_last_tx'] = df.groupby('sender_address')['timestamp'].diff()
        df['time_since_last_tx_hours'] = df['time_since_last_tx'].dt.total_seconds() / 3600
        df['time_since_last_tx_hours'] = df['time_since_last_tx_hours'].fillna(df['time_since_last_tx_hours'].median())
        
        # Rapid transaction count (transactions in last hour)
        df['rapid_tx_count'] = df.groupby('sender_address').apply(
            lambda x: x.set_index('timestamp').rolling('1H').count()['amount']
        ).reset_index(level=0, drop=True)
        
        # Balance change ratio
        df['balance_change_ratio'] = df['amount'] / (df['sender_balance_before'] + 1e-6)
        
        # Gas anomaly score
        df['gas_anomaly_score'] = (df['gas_cost'] - df['gas_cost'].mean()) / df['gas_cost'].std()
        
        # Unusual counterparty (first time interaction)
        df['unusual_counterparty'] = ~df.apply(
            lambda row: any(
                (df['sender_address'] == row['sender_address']) & 
                (df['receiver_address'] == row['receiver_address']) &
                (df['timestamp'] < row['timestamp'])
            ), axis=1
        ).astype(int)
        
        # Volatility score (coefficient of variation)
        df['volatility_score'] = df['sender_std_amount'] / (df['sender_avg_amount'] + 1e-6)
        
        # Fill NaN values
        df = df.fillna(0)
        
        return df
    
    def save_dataset(self, df: pd.DataFrame, output_path: str):
        """Save dataset to file"""
        output_file = Path(__file__).parent / output_path
        df.to_csv(output_file, index=False)
        print(f"Dataset saved to {output_file}")
    
    def generate_train_test_split(self, df: pd.DataFrame, test_size: float = 0.2) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Split data into train and test sets"""
        # Sort by timestamp to ensure temporal split
        df_sorted = df.sort_values('timestamp')
        split_idx = int(len(df_sorted) * (1 - test_size))
        
        train_df = df_sorted.iloc[:split_idx]
        test_df = df_sorted.iloc[split_idx:]
        
        print(f"Train set: {len(train_df)} transactions")
        print(f"Test set: {len(test_df)} transactions")
        print(f"Train fraud ratio: {train_df['is_fraud'].mean():.4f}")
        print(f"Test fraud ratio: {test_df['is_fraud'].mean():.4f}")
        
        return train_df, test_df

def main():
    """Main function to generate and save synthetic data"""
    generator = BlockchainDataGenerator()
    
    # Generate raw dataset
    raw_df = generator.generate_dataset()
    generator.save_dataset(raw_df, 'raw_transactions.csv')
    
    # Add engineered features
    processed_df = generator.add_engineered_features(raw_df)
    generator.save_dataset(processed_df, 'processed_transactions.csv')
    
    # Create train/test split
    train_df, test_df = generator.generate_train_test_split(processed_df)
    generator.save_dataset(train_df, 'train_transactions.csv')
    generator.save_dataset(test_df, 'test_transactions.csv')
    
    print("Synthetic data generation completed!")

if __name__ == "__main__":
    main()
