export interface ModelVersion{
    id: string;
    name: string;
    version: string;
    createdAt: Date;
    artifactPath: string;
}
export interface TrainingRun{
    id: string;
    model: ModelVersion;
    parameters: Record<string, any>;
    metrics: Record<string, number>;
    status: 'pending' | 'running' | 'completed' | 'failed';
}
export interface ValidationResult{
    model: ModelVersion;
    metrics: Record<string, number>;
    passed: boolean;
}
export interface Deployment{
    id: string;
    model: ModelVersion;
    status: 'deployed'| 'rollback' | 'staging';
    endpoint: string;
}
export interface DriftAlert{
    feature: string;
    oldDistribution: any;
    newDistribution: boolean;
    timestamp: Date;
}