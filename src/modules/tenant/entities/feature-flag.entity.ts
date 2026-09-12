import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'feature_flags', schema: 'platform' })
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ length: 100 })
  feature: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ name: 'enabled_at', type: 'timestamptz', nullable: true })
  enabledAt: Date | null;
}
