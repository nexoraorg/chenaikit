import {ModelVersion, Deployment} from './types';
import crypto from 'crypto';

export class DeploymentManager{
    async deploy(model: ModelVersion, endpoint: string):Promise<Deployment>{
        const deployment: Deployment={
            id: crypto.randomUUID(),
            model,
            status: 'deployed',
            endpoint,
        };
        console.log(`MOdel deployed to ${endpoint}`);
        return deployment;
    }
}