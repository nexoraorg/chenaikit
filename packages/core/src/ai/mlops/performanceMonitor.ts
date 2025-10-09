import {Deployment} from './types';

export class PerformanceMonitor{
    startMonitoring(deployment: Deployment){
        console.log(`Monitoring started for ${deployment.model.version} at ${deployment.endpoint}`);

    }
    alert(metric: string, value: number){
        console.warn(`Alert : ${metric} is at ${value}`);
    }
}