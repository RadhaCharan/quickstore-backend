import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

export type OnboardingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Entity({ name: 'onboarding_requests', schema: 'platform' })
export class OnboardingRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'requested_features', type: 'text', array: true, default: [] })
  requestedFeatures: string[];

  @Column({ name: 'store_description', type: 'text', nullable: true })
  storeDescription: string | null;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ default: 'PENDING' })
  status: OnboardingStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
