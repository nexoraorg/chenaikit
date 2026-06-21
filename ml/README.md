# Chenaikit Machine Learning Infrastructure

This directory contains the complete MLOps infrastructure for credit scoring and fraud detection models using blockchain transaction data.

## 📁 Directory Structure

```
ml/
├── config/
│   └── ml_config.yaml              # ML configuration and hyperparameters
├── data/
│   ├── generate_synthetic_data.py   # Synthetic blockchain data generator
│   └── preprocessing.py             # Data preprocessing pipeline
├── training/
│   ├── train_credit_score.py        # Credit scoring model training
│   └── train_fraud_detector.py      # Fraud detection model training
├── evaluation/
│   └── metrics.py                   # Model evaluation and metrics
├── deployment/
│   └── deploy_model.py              # Model deployment as REST API
├── models/                          # Trained model storage
├── experiments/                     # ML experiment tracking
└── requirements.txt                # Python dependencies
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd ml
pip install -r requirements.txt
```

### 2. Generate Synthetic Data

```bash
cd data
python generate_synthetic_data.py
```

This creates:
- `raw_transactions.csv` - Raw synthetic transactions
- `processed_transactions.csv` - Feature-engineered data
- `train_transactions.csv` - Training set
- `test_transactions.csv` - Test set

### 3. Train Models

```bash
cd training
# Train credit scoring models
python train_credit_score.py

# Train fraud detection models
python train_fraud_detector.py
```

### 4. Deploy API

```bash
cd deployment
python deploy_model.py
```

The API will be available at `http://localhost:8000`

## 📊 Features

### Data Generation
- **Realistic blockchain transactions** with synthetic data
- **Feature engineering** for ML models
- **Class imbalance handling** for fraud detection
- **Time-based splits** for temporal validation

### Model Training
- **Multiple algorithms**: Gradient Boosting, Random Forest, Neural Networks
- **Hyperparameter tuning** with GridSearchCV
- **Cross-validation** and early stopping
- **MLflow integration** for experiment tracking
- **ONNX export** for cross-platform deployment

### Evaluation
- **Comprehensive metrics** for both regression and classification
- **Business impact analysis** with cost calculations
- **Visualization** with matplotlib and plotly
- **Model comparison** tools

### Deployment
- **FastAPI REST API** with authentication
- **Prometheus metrics** for monitoring
- **S3 integration** for model storage
- **Batch prediction** support
- **A/B testing** capabilities

## 🔧 Configuration

Edit `config/ml_config.yaml` to customize:

- Data generation parameters
- Model hyperparameters
- Training settings
- Evaluation metrics
- Deployment configuration

## 📈 Model Performance

### Credit Scoring
- **Target**: Predict credit scores (300-850)
- **Metrics**: RMSE, MAE, R², correlation
- **Business Goal**: ±50 point accuracy

### Fraud Detection
- **Target**: Detect fraudulent transactions
- **Metrics**: F1-score, ROC-AUC, precision, recall
- **Business Goal**: Minimize false negatives

## 🌐 API Usage

### Credit Score Prediction

```bash
curl -X POST "http://localhost:8000/predict/credit-score" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "credit_scoring_gradient_boosting",
    "transaction": {
      "amount": 1000.0,
      "sender_address": "0x123...",
      "receiver_address": "0x456...",
      "gas_used": 21000,
      "gas_price": 20.0,
      "sender_balance_before": 10000.0,
      "receiver_balance_before": 5000.0
    }
  }'
```

### Fraud Detection

```bash
curl -X POST "http://localhost:8000/predict/fraud" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "fraud_detection_random_forest",
    "transaction": {
      "amount": 1000.0,
      "sender_address": "0x123...",
      "receiver_address": "0x456...",
      "gas_used": 21000,
      "gas_price": 20.0,
      "sender_balance_before": 10000.0,
      "receiver_balance_before": 5000.0
    }
  }'
```

### Batch Prediction

```bash
curl -X POST "http://localhost:8000/predict/batch" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "fraud_detection_random_forest",
    "transactions": [
      {
        "amount": 1000.0,
        "sender_address": "0x123...",
        "receiver_address": "0x456...",
        "gas_used": 21000,
        "gas_price": 20.0,
        "sender_balance_before": 10000.0,
        "receiver_balance_before": 5000.0
      }
    ]
  }'
```

## 📊 Monitoring

### Prometheus Metrics

Access metrics at `http://localhost:8000/metrics`

Available metrics:
- `model_requests_total` - Total requests per model
- `model_request_duration_seconds` - Request latency
- `model_accuracy` - Model accuracy
- `model_load_time_seconds` - Model loading time

### Health Check

```bash
curl http://localhost:8000/health
```

### Model List

```bash
curl http://localhost:8000/models
```

## 🧪 Experiment Tracking

Models are automatically tracked with MLflow:

```bash
# Start MLflow UI
mlflow ui

# View experiments at http://localhost:5000
```

## 🔒 Security

The API uses Bearer token authentication. Configure your tokens in production.

## 📦 Model Storage

Models are stored in:
- Local: `ml/models/`
- S3: Configurable via `ml_config.yaml`

## 🔄 Continuous Training

Set up automated retraining:

```bash
# Add to crontab for daily retraining
0 2 * * * cd /path/to/ml && python training/train_fraud_detector.py
```

## 🧪 Testing

Run evaluation on test data:

```bash
cd evaluation
python metrics.py
```

## 📝 Logging

Logs are configured for production monitoring:
- Model loading/unloading
- Prediction requests/responses
- Error tracking
- Performance metrics

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "deployment/deploy_model.py"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chenaikit-ml-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chenaikit-ml-api
  template:
    metadata:
      labels:
        app: chenaikit-ml-api
    spec:
      containers:
      - name: ml-api
        image: chenaikit-ml-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: MODEL_PATH
          value: "/app/models"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Check the logs for error details
- Review the configuration files

## 🔄 Version History

- **v1.0.0** - Initial release with complete MLOps pipeline
- **v1.1.0** - Added ONNX export and A/B testing
- **v1.2.0** - Enhanced monitoring and alerting
