#!/usr/bin/env python3
"""
Model Evaluation Metrics for Credit Scoring and Fraud Detection
Comprehensive evaluation suite with visualization and reporting
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple, Any
import yaml
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Classification metrics
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report, precision_recall_curve,
    roc_curve, average_precision_score, matthews_corrcoef,
    brier_score_loss, log_loss
)

# Regression metrics
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    mean_absolute_percentage_error, explained_variance_score
)

# Statistical tests
from scipy import stats
from scipy.stats import ks_2samp

# Visualization
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

class ModelEvaluator:
    """Comprehensive model evaluation suite"""
    
    def __init__(self, config_path: str = "config/ml_config.yaml"):
        """Initialize evaluator with configuration"""
        self.config = self._load_config(config_path)
        self.evaluation_results = {}
        
        # Set up plotting style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
    def _load_config(self, config_path: str) -> Dict:
        """Load ML configuration"""
        config_file = Path(__file__).parent.parent / config_path
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
    
    def evaluate_credit_scoring_model(self, y_true: np.ndarray, y_pred: np.ndarray, 
                                    model_name: str = "credit_model") -> Dict:
        """Evaluate credit scoring model (regression)"""
        print(f"Evaluating credit scoring model: {model_name}")
        
        # Basic regression metrics
        metrics = {
            'mse': mean_squared_error(y_true, y_pred),
            'mae': mean_absolute_error(y_true, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_true, y_pred)),
            'r2': r2_score(y_true, y_pred),
            'explained_variance': explained_variance_score(y_true, y_pred),
            'mape': mean_absolute_percentage_error(y_true, y_pred),
            'max_error': np.max(np.abs(y_true - y_pred))
        }
        
        # Residual analysis
        residuals = y_true - y_pred
        metrics.update({
            'residual_mean': np.mean(residuals),
            'residual_std': np.std(residuals),
            'residual_skewness': stats.skew(residuals),
            'residual_kurtosis': stats.kurtosis(residuals)
        })
        
        # Error distribution by credit score bands
        score_bands = [300, 500, 600, 700, 800, 850]
        band_errors = {}
        
        for i in range(len(score_bands) - 1):
            lower, upper = score_bands[i], score_bands[i + 1]
            mask = (y_true >= lower) & (y_true < upper)
            if np.sum(mask) > 0:
                band_mae = mean_absolute_error(y_true[mask], y_pred[mask])
                band_errors[f"{lower}-{upper}"] = band_mae
        
        metrics['band_errors'] = band_errors
        
        # Statistical tests
        # Kolmogorov-Smirnov test for normality of residuals
        ks_stat, ks_pvalue = ks_2samp(residuals, np.random.normal(0, np.std(residuals), len(residuals)))
        metrics['residual_ks_stat'] = ks_stat
        metrics['residual_ks_pvalue'] = ks_pvalue
        
        # Correlation between predicted and actual
        correlation = np.corrcoef(y_true, y_pred)[0, 1]
        metrics['correlation'] = correlation
        
        # Business metrics
        # Accuracy within ±50 points
        accuracy_50 = np.mean(np.abs(y_true - y_pred) <= 50)
        metrics['accuracy_50_points'] = accuracy_50
        
        # Accuracy within ±100 points
        accuracy_100 = np.mean(np.abs(y_true - y_pred) <= 100)
        metrics['accuracy_100_points'] = accuracy_100
        
        print(f"RMSE: {metrics['rmse']:.2f}, R²: {metrics['r2']:.3f}")
        print(f"Correlation: {metrics['correlation']:.3f}")
        print(f"Accuracy ±50 points: {metrics['accuracy_50_points']:.3f}")
        
        self.evaluation_results[model_name] = {
            'type': 'credit_scoring',
            'metrics': metrics,
            'y_true': y_true,
            'y_pred': y_pred
        }
        
        return metrics
    
    def evaluate_fraud_detection_model(self, y_true: np.ndarray, y_pred: np.ndarray, 
                                     y_proba: np.ndarray = None, model_name: str = "fraud_model") -> Dict:
        """Evaluate fraud detection model (classification)"""
        print(f"Evaluating fraud detection model: {model_name}")
        
        # Basic classification metrics
        metrics = {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, average='binary'),
            'recall': recall_score(y_true, y_pred, average='binary'),
            'f1': f1_score(y_true, y_pred, average='binary'),
            'matthews_corrcoef': matthews_corrcoef(y_true, y_pred)
        }
        
        # Confusion matrix components
        cm = confusion_matrix(y_true, y_pred)
        tn, fp, fn, tp = cm.ravel()
        
        metrics.update({
            'true_negatives': tn,
            'false_positives': fp,
            'false_negatives': fn,
            'true_positives': tp,
            'false_positive_rate': fp / (fp + tn) if (fp + tn) > 0 else 0,
            'false_negative_rate': fn / (fn + tp) if (fn + tp) > 0 else 0,
            'true_positive_rate': tp / (tp + fn) if (tp + fn) > 0 else 0,
            'true_negative_rate': tn / (tn + fp) if (tn + fp) > 0 else 0
        })
        
        # Probability-based metrics (if probabilities available)
        if y_proba is not None:
            metrics.update({
                'roc_auc': roc_auc_score(y_true, y_proba),
                'average_precision': average_precision_score(y_true, y_proba),
                'brier_score': brier_score_loss(y_true, y_proba),
                'log_loss': log_loss(y_true, y_proba)
            })
            
            # Precision-Recall curve analysis
            precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
            f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-8)
            
            optimal_idx = np.argmax(f1_scores)
            metrics.update({
                'optimal_threshold': thresholds[optimal_idx] if optimal_idx < len(thresholds) else 0.5,
                'optimal_f1': f1_scores[optimal_idx],
                'optimal_precision': precisions[optimal_idx],
                'optimal_recall': recalls[optimal_idx]
            })
            
            # ROC curve analysis
            fpr, tpr, roc_thresholds = roc_curve(y_true, y_proba)
            youden_j = tpr - fpr
            optimal_roc_idx = np.argmax(youden_j)
            
            metrics.update({
                'optimal_roc_threshold': roc_thresholds[optimal_roc_idx],
                'optimal_sensitivity': tpr[optimal_roc_idx],
                'optimal_specificity': 1 - fpr[optimal_roc_idx]
            })
        
        # Business metrics
        # Cost-based evaluation (assuming costs)
        cost_fp = 100  # Cost of false positive (investigating legitimate transaction)
        cost_fn = 1000  # Cost of false negative (missing fraudulent transaction)
        cost_tp = 50    # Cost of true positive (investigating caught fraud)
        cost_tn = 1     # Cost of true negative (processing legitimate transaction)
        
        total_cost = (fp * cost_fp + fn * cost_fn + tp * cost_tp + tn * cost_tn)
        metrics['total_business_cost'] = total_cost
        metrics['cost_per_transaction'] = total_cost / len(y_true)
        
        # Fraud detection rate at different precision levels
        if y_proba is not None:
            # High precision (90%) scenario
            high_precision_threshold = np.percentile(y_proba[y_true == 1], 10)
            high_precision_pred = (y_proba >= high_precision_threshold).astype(int)
            high_precision_recall = recall_score(y_true, high_precision_pred)
            metrics['high_precision_recall'] = high_precision_recall
            
            # High recall (90%) scenario
            high_recall_threshold = np.percentile(y_proba[y_true == 0], 90)
            high_recall_pred = (y_proba >= high_recall_threshold).astype(int)
            high_recall_precision = precision_score(y_true, high_recall_pred)
            metrics['high_recall_precision'] = high_recall_precision
        
        print(f"F1: {metrics['f1']:.3f}, ROC-AUC: {metrics.get('roc_auc', 0):.3f}")
        print(f"Precision: {metrics['precision']:.3f}, Recall: {metrics['recall']:.3f}")
        print(f"Business cost per transaction: ${metrics['cost_per_transaction']:.2f}")
        
        self.evaluation_results[model_name] = {
            'type': 'fraud_detection',
            'metrics': metrics,
            'y_true': y_true,
            'y_pred': y_pred,
            'y_proba': y_proba
        }
        
        return metrics
    
    def plot_credit_scoring_results(self, model_name: str, save_path: str = None):
        """Create visualization plots for credit scoring model"""
        if model_name not in self.evaluation_results:
            print(f"No results found for model: {model_name}")
            return
        
        results = self.evaluation_results[model_name]
        if results['type'] != 'credit_scoring':
            print(f"Model {model_name} is not a credit scoring model")
            return
        
        y_true = results['y_true']
        y_pred = results['y_pred']
        metrics = results['metrics']
        
        # Create subplots
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle(f'Credit Scoring Model Evaluation: {model_name}', fontsize=16)
        
        # 1. Predicted vs Actual scatter plot
        axes[0, 0].scatter(y_true, y_pred, alpha=0.6, s=20)
        axes[0, 0].plot([y_true.min(), y_true.max()], [y_true.min(), y_true.max()], 'r--', lw=2)
        axes[0, 0].set_xlabel('Actual Credit Score')
        axes[0, 0].set_ylabel('Predicted Credit Score')
        axes[0, 0].set_title(f'Predicted vs Actual (R² = {metrics["r2"]:.3f})')
        axes[0, 0].grid(True, alpha=0.3)
        
        # 2. Residual plot
        residuals = y_true - y_pred
        axes[0, 1].scatter(y_pred, residuals, alpha=0.6, s=20)
        axes[0, 1].axhline(y=0, color='r', linestyle='--')
        axes[0, 1].set_xlabel('Predicted Credit Score')
        axes[0, 1].set_ylabel('Residuals')
        axes[0, 1].set_title('Residual Plot')
        axes[0, 1].grid(True, alpha=0.3)
        
        # 3. Residual histogram
        axes[1, 0].hist(residuals, bins=50, alpha=0.7, edgecolor='black')
        axes[1, 0].set_xlabel('Residuals')
        axes[1, 0].set_ylabel('Frequency')
        axes[1, 0].set_title(f'Residual Distribution (Mean: {metrics["residual_mean"]:.2f})')
        axes[1, 0].grid(True, alpha=0.3)
        
        # 4. Error by credit score bands
        if 'band_errors' in metrics:
            bands = list(metrics['band_errors'].keys())
            errors = list(metrics['band_errors'].values())
            
            axes[1, 1].bar(range(len(bands)), errors)
            axes[1, 1].set_xlabel('Credit Score Bands')
            axes[1, 1].set_ylabel('Mean Absolute Error')
            axes[1, 1].set_title('Error by Credit Score Bands')
            axes[1, 1].set_xticks(range(len(bands)))
            axes[1, 1].set_xticklabels(bands, rotation=45)
            axes[1, 1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"Plot saved to {save_path}")
        else:
            plt.show()
    
    def plot_fraud_detection_results(self, model_name: str, save_path: str = None):
        """Create visualization plots for fraud detection model"""
        if model_name not in self.evaluation_results:
            print(f"No results found for model: {model_name}")
            return
        
        results = self.evaluation_results[model_name]
        if results['type'] != 'fraud_detection':
            print(f"Model {model_name} is not a fraud detection model")
            return
        
        y_true = results['y_true']
        y_pred = results['y_pred']
        y_proba = results['y_proba']
        metrics = results['metrics']
        
        # Create subplots
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle(f'Fraud Detection Model Evaluation: {model_name}', fontsize=16)
        
        # 1. Confusion Matrix
        cm = confusion_matrix(y_true, y_pred)
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[0, 0])
        axes[0, 0].set_title('Confusion Matrix')
        axes[0, 0].set_xlabel('Predicted')
        axes[0, 0].set_ylabel('Actual')
        
        # 2. ROC Curve (if probabilities available)
        if y_proba is not None:
            fpr, tpr, _ = roc_curve(y_true, y_proba)
            axes[0, 1].plot(fpr, tpr, linewidth=2, label=f'ROC-AUC = {metrics["roc_auc"]:.3f}')
            axes[0, 1].plot([0, 1], [0, 1], 'r--', linewidth=2)
            axes[0, 1].set_xlabel('False Positive Rate')
            axes[0, 1].set_ylabel('True Positive Rate')
            axes[0, 1].set_title('ROC Curve')
            axes[0, 1].legend()
            axes[0, 1].grid(True, alpha=0.3)
        else:
            axes[0, 1].text(0.5, 0.5, 'No probabilities available', ha='center', va='center')
            axes[0, 1].set_title('ROC Curve (N/A)')
        
        # 3. Precision-Recall Curve (if probabilities available)
        if y_proba is not None:
            precisions, recalls, _ = precision_recall_curve(y_true, y_proba)
            axes[0, 2].plot(recalls, precisions, linewidth=2, label=f'AP = {metrics["average_precision"]:.3f}')
            axes[0, 2].set_xlabel('Recall')
            axes[0, 2].set_ylabel('Precision')
            axes[0, 2].set_title('Precision-Recall Curve')
            axes[0, 2].legend()
            axes[0, 2].grid(True, alpha=0.3)
        else:
            axes[0, 2].text(0.5, 0.5, 'No probabilities available', ha='center', va='center')
            axes[0, 2].set_title('Precision-Recall Curve (N/A)')
        
        # 4. Probability distribution (if available)
        if y_proba is not None:
            fraud_probs = y_proba[y_true == 1]
            legit_probs = y_proba[y_true == 0]
            
            axes[1, 0].hist([legit_probs, fraud_probs], bins=50, alpha=0.7, 
                          label=['Legitimate', 'Fraud'], density=True)
            axes[1, 0].set_xlabel('Predicted Probability')
            axes[1, 0].set_ylabel('Density')
            axes[1, 0].set_title('Probability Distribution')
            axes[1, 0].legend()
            axes[1, 0].grid(True, alpha=0.3)
        else:
            axes[1, 0].text(0.5, 0.5, 'No probabilities available', ha='center', va='center')
            axes[1, 0].set_title('Probability Distribution (N/A)')
        
        # 5. Metrics bar chart
        metric_names = ['Precision', 'Recall', 'F1-Score', 'Accuracy']
        metric_values = [metrics['precision'], metrics['recall'], metrics['f1'], metrics['accuracy']]
        
        bars = axes[1, 1].bar(metric_names, metric_values, alpha=0.7)
        axes[1, 1].set_ylabel('Score')
        axes[1, 1].set_title('Classification Metrics')
        axes[1, 1].set_ylim(0, 1)
        axes[1, 1].grid(True, alpha=0.3)
        
        # Add value labels on bars
        for bar, value in zip(bars, metric_values):
            axes[1, 1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                          f'{value:.3f}', ha='center', va='bottom')
        
        # 6. Cost analysis
        cost_components = ['False\nPositives', 'False\nNegatives', 'True\nPositives', 'True\nNegatives']
        cost_values = [
            metrics['false_positives'] * 100,
            metrics['false_negatives'] * 1000,
            metrics['true_positives'] * 50,
            metrics['true_negatives'] * 1
        ]
        
        colors = ['red', 'darkred', 'orange', 'green']
        bars = axes[1, 2].bar(cost_components, cost_values, color=colors, alpha=0.7)
        axes[1, 2].set_ylabel('Cost ($)')
        axes[1, 2].set_title(f'Business Cost Analysis\n(Total: ${metrics["total_business_cost"]:,.0f})')
        axes[1, 2].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"Plot saved to {save_path}")
        else:
            plt.show()
    
    def generate_evaluation_report(self, model_name: str, save_path: str = None) -> str:
        """Generate comprehensive evaluation report"""
        if model_name not in self.evaluation_results:
            return f"No results found for model: {model_name}"
        
        results = self.evaluation_results[model_name]
        metrics = results['metrics']
        
        report = f"""
# Model Evaluation Report: {model_name}

## Model Type: {results['type'].replace('_', ' ').title()}

## Performance Metrics

"""
        
        if results['type'] == 'credit_scoring':
            report += f"""
### Regression Metrics
- **RMSE**: {metrics['rmse']:.3f}
- **MAE**: {metrics['mae']:.3f}
- **R²**: {metrics['r2']:.3f}
- **Correlation**: {metrics['correlation']:.3f}
- **Explained Variance**: {metrics['explained_variance']:.3f}

### Business Metrics
- **Accuracy ±50 points**: {metrics['accuracy_50_points']:.3f}
- **Accuracy ±100 points**: {metrics['accuracy_100_points']:.3f}

### Residual Analysis
- **Residual Mean**: {metrics['residual_mean']:.3f}
- **Residual Std**: {metrics['residual_std']:.3f}
- **Residual Skewness**: {metrics['residual_skewness']:.3f}
- **Residual Kurtosis**: {metrics['residual_kurtosis']:.3f}

"""
            
            if 'band_errors' in metrics:
                report += "### Error by Credit Score Bands\n"
                for band, error in metrics['band_errors'].items():
                    report += f"- **{band}**: {error:.3f}\n"
        
        elif results['type'] == 'fraud_detection':
            report += f"""
### Classification Metrics
- **Accuracy**: {metrics['accuracy']:.3f}
- **Precision**: {metrics['precision']:.3f}
- **Recall**: {metrics['recall']:.3f}
- **F1-Score**: {metrics['f1']:.3f}
- **Matthews Correlation Coefficient**: {metrics['matthews_corrcoef']:.3f}

### Confusion Matrix
- **True Positives**: {metrics['true_positives']}
- **True Negatives**: {metrics['true_negatives']}
- **False Positives**: {metrics['false_positives']}
- **False Negatives**: {metrics['false_negatives']}

### Rates
- **True Positive Rate (Sensitivity)**: {metrics['true_positive_rate']:.3f}
- **True Negative Rate (Specificity)**: {metrics['true_negative_rate']:.3f}
- **False Positive Rate**: {metrics['false_positive_rate']:.3f}
- **False Negative Rate**: {metrics['false_negative_rate']:.3f}

"""
            
            if 'roc_auc' in metrics:
                report += f"""
### Probability-Based Metrics
- **ROC-AUC**: {metrics['roc_auc']:.3f}
- **Average Precision**: {metrics['average_precision']:.3f}
- **Brier Score**: {metrics['brier_score']:.3f}
- **Log Loss**: {metrics['log_loss']:.3f}

### Optimal Thresholds
- **Optimal F1 Threshold**: {metrics['optimal_threshold']:.3f}
- **Optimal F1 Score**: {metrics['optimal_f1']:.3f}
- **Optimal Precision**: {metrics['optimal_precision']:.3f}
- **Optimal Recall**: {metrics['optimal_recall']:.3f}

### Business Impact
- **Total Business Cost**: ${metrics['total_business_cost']:,.0f}
- **Cost per Transaction**: ${metrics['cost_per_transaction']:.2f}

"""
        
        report += f"""
## Recommendations

"""
        
        if results['type'] == 'credit_scoring':
            if metrics['r2'] > 0.8:
                report += "- **Excellent model performance** with high R² score\n"
            elif metrics['r2'] > 0.6:
                report += "- **Good model performance** - consider feature engineering for improvement\n"
            else:
                report += "- **Model needs improvement** - consider additional features or different algorithms\n"
            
            if metrics['accuracy_50_points'] > 0.7:
                report += "- **High accuracy** within ±50 points - suitable for production\n"
            else:
                report += "- **Moderate accuracy** - may need calibration for business use\n"
        
        elif results['type'] == 'fraud_detection':
            if metrics['f1'] > 0.8:
                report += "- **Excellent fraud detection** with high F1 score\n"
            elif metrics['f1'] > 0.6:
                report += "- **Good fraud detection** - monitor false positives\n"
            else:
                report += "- **Model needs improvement** - consider rebalancing or feature engineering\n"
            
            if metrics['false_negative_rate'] < 0.1:
                report += "- **Low false negative rate** - good for fraud prevention\n"
            else:
                report += "- **High false negative rate** - may miss fraudulent transactions\n"
        
        if save_path:
            with open(save_path, 'w') as f:
                f.write(report)
            print(f"Evaluation report saved to {save_path}")
        
        return report
    
    def compare_models(self, model_names: List[str]) -> pd.DataFrame:
        """Compare multiple models side by side"""
        comparison_data = []
        
        for model_name in model_names:
            if model_name not in self.evaluation_results:
                continue
            
            results = self.evaluation_results[model_name]
            metrics = results['metrics']
            
            row = {'Model': model_name, 'Type': results['type']}
            
            # Add relevant metrics based on model type
            if results['type'] == 'credit_scoring':
                row.update({
                    'RMSE': metrics['rmse'],
                    'MAE': metrics['mae'],
                    'R²': metrics['r2'],
                    'Correlation': metrics['correlation'],
                    'Accuracy ±50': metrics['accuracy_50_points']
                })
            elif results['type'] == 'fraud_detection':
                row.update({
                    'Accuracy': metrics['accuracy'],
                    'Precision': metrics['precision'],
                    'Recall': metrics['recall'],
                    'F1': metrics['f1'],
                    'ROC-AUC': metrics.get('roc_auc', 0)
                })
            
            comparison_data.append(row)
        
        comparison_df = pd.DataFrame(comparison_data)
        return comparison_df

def main():
    """Example usage of model evaluator"""
    # Sample data for demonstration
    np.random.seed(42)
    
    # Credit scoring sample
    y_true_credit = np.random.randint(300, 851, 1000)
    y_pred_credit = y_true_credit + np.random.normal(0, 30, 1000)
    
    # Fraud detection sample
    y_true_fraud = np.random.randint(0, 2, 1000)
    y_proba_fraud = np.random.random(1000)
    y_pred_fraud = (y_proba_fraud > 0.5).astype(int)
    
    # Create evaluator
    evaluator = ModelEvaluator()
    
    # Evaluate models
    evaluator.evaluate_credit_scoring_model(y_true_credit, y_pred_credit, "credit_model_demo")
    evaluator.evaluate_fraud_detection_model(y_true_fraud, y_pred_fraud, y_proba_fraud, "fraud_model_demo")
    
    # Generate reports
    print(evaluator.generate_evaluation_report("credit_model_demo"))
    print(evaluator.generate_evaluation_report("fraud_model_demo"))
    
    # Compare models
    comparison = evaluator.compare_models(["credit_model_demo", "fraud_model_demo"])
    print("\nModel Comparison:")
    print(comparison)

if __name__ == "__main__":
    main()
