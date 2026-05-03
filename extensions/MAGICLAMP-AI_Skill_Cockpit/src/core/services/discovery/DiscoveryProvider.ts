
import { Skill } from '@shared/types';

export interface DiscoveryProvider {
    discover(): Promise<Skill[]>;
}
