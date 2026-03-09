#!/usr/bin/env python3
"""
Model Deployment Script
Deploys trained ML models as REST APIs with monitoring and versioning
"""

import joblib
import yaml
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# FastAPI for deployment
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import uvicorn

# MLflow for model registry
import mlflow
import mlflow.sklearn

# Monitoring
import prometheus_client
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# AWS S3 for model storage
import boto3
from botocore.exceptions import ClientError

# ONNX for cross-platform inference
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False

# Import preprocessing
import sys
sys.path.append(str(Path(__file__).parent.parent / 'data'))
from preprocessing import DataPreprocessor

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter('model_requests_total', 'Total model requests', ['model_name', 'endpoint'])
REQUEST_LATENCY = Histogram('model_request_duration_seconds', 'Model request latency')
MODEL_ACCURACY = Gauge('model_accuracy', 'Model accuracy', ['model_name'])
MODEL_LOAD_TIME = Gauge('model_load_time_seconds', 'Time to load model')

# Security
security = HTTPBearer()

class ModelDeployment:
    """Model deployment manager"""
    
    def __init__(self, config_path: str = "config/ml_config.yaml"):
        """Initialize deployment manager"""
        self.config = self._load_config(config_path)
        self.models = {}
        self.preprocessors = {}
        self.model_metadata = {}
        
        # Initialize S3 client
        self.s3_client = boto3.client('s3')
        
        # Set up MLflow
        mlflow.set_tracking_uri(self.config['experiment_tracking']['tracking_uri'])
        
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration"""
        config_file = Path(__file__).parent.parent / config_path
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
    
    def load_model_from_file(self, model_path: str, model_name: str) -> Any:
        """Load model from local file"""
        start_time = datetime.now()
        
        try:
            model_file = Path(__file__).parent.parent / model_path
            model = joblib.load(model_file)
            
            load_time = (datetime.now() - start_time).total_seconds()
            MODEL_LOAD_TIME.labels(model_name=model_name).set(load_time)
            
            logger.info(f"Model {model_name} loaded in {load_time:.2f} seconds")
            return model
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Model loading failed: {str(e)}")
    
    def load_model_from_s3(self, model_key: str, model_name: str, bucket_name: str = None) -> Any:
        """Load model from S3"""
        if bucket_name is None:
            bucket_name = self.config['deployment']['model_registry'].replace('s3://', '').split('/')[0]
        
        start_time = datetime.now()
        
        try:
            # Download model from S3
            local_path = Path(__file__).parent.parent / f"models/{model_name}.pkl"
            self.s3_client.download_file(bucket_name, model_key, str(local_path))
            
            # Load model
            model = joblib.load(local_path)
            
            load_time = (datetime.now() - start_time).total_seconds()
            MODEL_LOAD_TIME.labels(model_name=model_name).set(load_time)
            
            logger.info(f"Model {model_name} loaded from S3 in {load_time:.2f} seconds")
            return model
            
        except ClientError as e:
            logger.error(f"Failed to download model from S3: {str(e)}")
            raise HTTPException(status_code=500, detail=f"S3 download failed: {str(e)}")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Model loading failed: {str(e)}")
    
    def load_onnx_model(self, model_path: str, model_name: str) -> ort.InferenceSession:
        """Load ONNX model for inference"""
        if not ONNX_AVAILABLE:
            raise HTTPException(status_code=500, detail="ONNX runtime not available")
        
        start_time = datetime.now()
        
        try:
            model_file = Path(__file__).parent.parent / model_path
            session = ort.InferenceSession(str(model_file))
            
            load_time = (datetime.now() - start_time).total_seconds()
            MODEL_LOAD_TIME.labels(model_name=model_name).set(load_time)
            
            logger.info(f"ONNX model {model_name} loaded in {load_time:.2f} seconds")
            return session
            
        except Exception as e:
            logger.error(f"Failed to load ONNX model {model_name}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"ONNX model loading failed: {str(e)}")
    
    def load_preprocessor(self, preprocessor_path: str, model_type: str) -> DataPreprocessor:
        """Load fitted preprocessor"""
        try:
            preprocessor_file = Path(__file__).parent.parent / preprocessor_path
            preprocessor = DataPreprocessor()
            preprocessor.load_preprocessors(str(preprocessor_file))
            
            logger.info(f"Preprocessor for {model_type} loaded")
            return preprocessor
            
        except Exception as e:
            logger.error(f"Failed to load preprocessor: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Preprocessor loading failed: {str(e)}")
    
    def deploy_credit_scoring_model(self, model_name: str = "credit_scoring_gradient_boosting"):
        """Deploy credit scoring model"""
        logger.info(f"Deploying credit scoring model: {model_name}")
        
        # Load model
        model = self.load_model_from_file(f"models/credit_scoring_{model_name}.pkl", model_name)
        self.models[model_name] = model
        
        # Load preprocessor
        preprocessor = self.load_preprocessor('data/credit_preprocessors.pkl', 'credit_scoring')
        self.preprocessors[model_name] = preprocessor
        
        # Store metadata
        self.model_metadata[model_name] = {
            'type': 'credit_scoring',
            'input_features': preprocessor.feature_columns,
            'target': 'credit_score',
            'model_format': 'sklearn',
            'deployed_at': datetime.now().isoformat()
        }
        
        logger.info(f"Credit scoring model {model_name} deployed successfully")
    
    def deploy_fraud_detection_model(self, model_name: str = "fraud_detection_random_forest"):
        """Deploy fraud detection model"""
        logger.info(f"Deploying fraud detection model: {model_name}")
        
        # Load model
        model = self.load_model_from_file(f"models/fraud_detection_{model_name}.pkl", model_name)
        self.models[model_name] = model
        
        # Load preprocessor
        preprocessor = self.load_preprocessor('data/fraud_preprocessors.pkl', 'fraud_detection')
        self.preprocessors[model_name] = preprocessor
        
        # Store metadata
        self.model_metadata[model_name] = {
            'type': 'fraud_detection',
            'input_features': preprocessor.feature_columns,
            'target': 'is_fraud',
            'model_format': 'sklearn',
            'deployed_at': datetime.now().isoformat()
        }
        
        logger.info(f"Fraud detection model {model_name} deployed successfully")
    
    def predict_credit_score(self, model_name: str, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Make credit score prediction"""
        if model_name not in self.models:
            raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
        
        if self.model_metadata[model_name]['type'] != 'credit_scoring':
            raise HTTPException(status_code=400, detail=f"Model {model_name} is not a credit scoring model")
        
        try:
            # Convert to DataFrame
            df = pd.DataFrame([transaction_data])
            
            # Preprocess
            preprocessor = self.preprocessors[model_name]
            df_processed = preprocessor.transform_new_data(df, 'credit_scoring')
            
            # Make prediction
            model = self.models[model_name]
            prediction = model.predict(df_processed)[0]
            
            # Add confidence interval if available
            result = {
                'predicted_credit_score': float(prediction),
                'model_name': model_name,
                'timestamp': datetime.now().isoformat(),
                'confidence': 'medium'  # Could be calculated based on model uncertainty
            }
            
            # Update metrics
            REQUEST_COUNT.labels(model_name=model_name, endpoint='predict_credit_score').inc()
            
            return result
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    
    def predict_fraud(self, model_name: str, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Make fraud prediction"""
        if model_name not in self.models:
            raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
        
        if self.model_metadata[model_name]['type'] != 'fraud_detection':
            raise HTTPException(status_code=400, detail=f"Model {model_name} is not a fraud detection model")
        
        try:
            # Convert to DataFrame
            df = pd.DataFrame([transaction_data])
            
            # Preprocess
            preprocessor = self.preprocessors[model_name]
            df_processed = preprocessor.transform_new_data(df, 'fraud_detection')
            
            # Make prediction
            model = self.models[model_name]
            prediction = model.predict(df_processed)[0]
            
            # Get probability if available
            probability = None
            if hasattr(model, 'predict_proba'):
                probability = model.predict_proba(df_processed)[0, 1]
            
            result = {
                'is_fraud': bool(prediction),
                'fraud_probability': float(probability) if probability is not None else None,
                'model_name': model_name,
                'timestamp': datetime.now().isoformat(),
                'risk_level': 'high' if prediction else 'low'
            }
            
            # Update metrics
            REQUEST_COUNT.labels(model_name=model_name, endpoint='predict_fraud').inc()
            
            return result
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    
    def batch_predict(self, model_name: str, transaction_data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Make batch predictions"""
        if model_name not in self.models:
            raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
        
        try:
            # Convert to DataFrame
            df = pd.DataFrame(transaction_data_list)
            
            # Preprocess
            preprocessor = self.preprocessors[model_name]
            model_type = self.model_metadata[model_name]['type']
            df_processed = preprocessor.transform_new_data(df, model_type)
            
            # Make predictions
            model = self.models[model_name]
            predictions = model.predict(df_processed)
            
            results = []
            for i, pred in enumerate(predictions):
                if model_type == 'credit_scoring':
                    result = {
                        'predicted_credit_score': float(pred),
                        'model_name': model_name,
                        'timestamp': datetime.now().isoformat()
                    }
                else:  # fraud detection
                    probability = None
                    if hasattr(model, 'predict_proba'):
                        probability = model.predict_proba(df_processed)[i, 1]
                    
                    result = {
                        'is_fraud': bool(pred),
                        'fraud_probability': float(probability) if probability is not None else None,
                        'model_name': model_name,
                        'timestamp': datetime.now().isoformat()
                    }
                
                results.append(result)
            
            # Update metrics
            REQUEST_COUNT.labels(model_name=model_name, endpoint='batch_predict').inc()
            
            return results
            
        except Exception as e:
            logger.error(f"Batch prediction failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")

# Pydantic models for API
class TransactionData(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount")
    sender_address: str = Field(..., description="Sender blockchain address")
    receiver_address: str = Field(..., description="Receiver blockchain address")
    gas_used: int = Field(..., ge=0, description="Gas used in transaction")
    gas_price: float = Field(..., ge=0, description="Gas price in Gwei")
    sender_balance_before: float = Field(..., ge=0, description="Sender balance before transaction")
    receiver_balance_before: float = Field(..., ge=0, description="Receiver balance before transaction")
    sender_credit_score: Optional[int] = Field(None, ge=300, le=850, description="Sender credit score")
    transaction_type: Optional[str] = Field("medium", description="Transaction type")
    hour_of_day: Optional[int] = Field(None, ge=0, le=23, description="Hour of day")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Day of week")

class BatchTransactionData(BaseModel):
    transactions: List[TransactionData] = Field(..., min_items=1, max_items=1000)

class PredictionRequest(BaseModel):
    model_name: str = Field(..., description="Name of the model to use")
    transaction: TransactionData = Field(..., description="Transaction data")

class BatchPredictionRequest(BaseModel):
    model_name: str = Field(..., description="Name of the model to use")
    transactions: List[TransactionData] = Field(..., min_items=1, max_items=1000)

# Initialize FastAPI app
app = FastAPI(
    title="Chenaikit ML API",
    description="Machine Learning API for credit scoring and fraud detection",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize deployment manager
deployment_manager = ModelDeployment()

@app.on_event("startup")
async def startup_event():
    """Initialize models on startup"""
    logger.info("Starting ML API deployment...")
    
    # Deploy default models
    try:
        deployment_manager.deploy_credit_scoring_model()
        deployment_manager.deploy_fraud_detection_model()
        logger.info("Models deployed successfully")
    except Exception as e:
        logger.error(f"Failed to deploy models: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Chenaikit ML API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/models")
async def list_models():
    """List available models"""
    return {
        "models": list(deployment_manager.models.keys()),
        "metadata": deployment_manager.model_metadata
    }

@app.post("/predict/credit-score")
async def predict_credit_score(
    request: PredictionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Predict credit score for a transaction"""
    with REQUEST_LATENCY.time():
        try:
            result = deployment_manager.predict_credit_score(
                request.model_name, 
                request.transaction.dict()
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/fraud")
async def predict_fraud(
    request: PredictionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Predict fraud for a transaction"""
    with REQUEST_LATENCY.time():
        try:
            result = deployment_manager.predict_fraud(
                request.model_name, 
                request.transaction.dict()
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch")
async def batch_predict(
    request: BatchPredictionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Make batch predictions"""
    with REQUEST_LATENCY.time():
        try:
            transaction_dicts = [tx.dict() for tx in request.transactions]
            results = deployment_manager.batch_predict(request.model_name, transaction_dicts)
            return {"predictions": results}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.post("/models/{model_name}/deploy")
async def deploy_model(
    model_name: str,
    model_type: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Deploy a new model"""
    try:
        if model_type == "credit_scoring":
            deployment_manager.deploy_credit_scoring_model(model_name)
        elif model_type == "fraud_detection":
            deployment_manager.deploy_fraud_detection_model(model_name)
        else:
            raise HTTPException(status_code=400, detail="Invalid model type")
        
        return {"message": f"Model {model_name} deployed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def main():
    """Main function to run the API server"""
    config = deployment_manager.config['deployment']
    
    uvicorn.run(
        app,
        host=config['api_host'],
        port=config['api_port'],
        log_level="info"
    )

if __name__ == "__main__":
    main()
