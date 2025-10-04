import {ModelVersion, ValidationResult} from './types';
export class ModelValidator{
    validate(model: ModelVersion): ValidationResult{
        const metrics= {accuracy: Math.random(), f1: Math.random()};
        const passed= metrics.accuracy>0.7;
        return {model, metrics , passed};
    }
}