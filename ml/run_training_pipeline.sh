#!/bin/bash

# Chenaikit ML Training Pipeline
# This script runs the complete ML training pipeline

set -e  # Exit on any error

echo "🚀 Starting Chenaikit ML Training Pipeline..."

# Create logs directory
mkdir -p logs
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/training_pipeline_${TIMESTAMP}.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if we're in the right directory
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found. Please run this script from the ml/ directory."
    exit 1
fi

log "📦 Installing dependencies..."
pip install -r requirements.txt 2>&1 | tee -a "$LOG_FILE"

log "📊 Step 1: Generating synthetic blockchain data..."
cd data
python generate_synthetic_data.py 2>&1 | tee -a "../$LOG_FILE"
if [ $? -eq 0 ]; then
    log "✅ Data generation completed successfully"
else
    log "❌ Data generation failed"
    exit 1
fi

log "🔧 Step 2: Running data preprocessing..."
python preprocessing.py 2>&1 | tee -a "../$LOG_FILE"
if [ $? -eq 0 ]; then
    log "✅ Data preprocessing completed successfully"
else
    log "❌ Data preprocessing failed"
    exit 1
fi

cd ..

log "🎯 Step 3: Training credit scoring models..."
cd training
python train_credit_score.py 2>&1 | tee -a "../$LOG_FILE"
if [ $? -eq 0 ]; then
    log "✅ Credit scoring training completed successfully"
else
    log "❌ Credit scoring training failed"
    exit 1
fi

log "🔍 Step 4: Training fraud detection models..."
python train_fraud_detector.py 2>&1 | tee -a "../$LOG_FILE"
if [ $? -eq 0 ]; then
    log "✅ Fraud detection training completed successfully"
else
    log "❌ Fraud detection training failed"
    exit 1
fi

cd ..

log "📈 Step 5: Running model evaluation..."
cd evaluation
python metrics.py 2>&1 | tee -a "../$LOG_FILE"
if [ $? -eq 0 ]; then
    log "✅ Model evaluation completed successfully"
else
    log "❌ Model evaluation failed"
    exit 1
fi

cd ..

log "🚀 Step 6: Starting model deployment API..."
cd deployment
# Start API in background
python deploy_model.py > "../logs/api_server_${TIMESTAMP}.log" 2>&1 &
API_PID=$!
echo $API_PID > "../logs/api_server.pid"
log "✅ Model deployment API started (PID: $API_PID)"

cd ..

log "🎉 Training pipeline completed successfully!"
log "📊 Models are deployed and available at http://localhost:8000"
log "📈 View MLflow experiments at http://localhost:5000"
log "📋 Full logs available at: $LOG_FILE"

# Display model files
log "📁 Generated model files:"
find models/ -name "*.pkl" -o -name "*.onnx" 2>/dev/null | while read file; do
    log "   - $file"
done

log "🔍 API Health Check:"
sleep 5  # Wait for API to start
curl -s http://localhost:8000/health | jq . 2>/dev/null || curl -s http://localhost:8000/health

echo ""
echo "🎯 Next steps:"
echo "1. Test the API: curl http://localhost:8000/models"
echo "2. View metrics: curl http://localhost:8000/metrics"
echo "3. Start MLflow UI: mlflow ui"
echo "4. Check logs: tail -f $LOG_FILE"
echo ""
echo "🛑 To stop the API server: kill \$(cat logs/api_server.pid)"
