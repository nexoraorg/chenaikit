import {DriftAlert} from './types';
export class DriftDetector{
    detect(oldData: any[], newData: any[]): DriftAlert[]{
        return oldData.map((_, idx)=>({
            feature: `feature$[idx]`,
            oldDistribution: oldData[idx],
            newDistribution: newData[idx],
            driftDetected: Math.random() > 0.8,
            timestamp: new Date(),
        }));
    }
}