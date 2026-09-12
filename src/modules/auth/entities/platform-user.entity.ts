import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';

@Entity({ name: 'users', schema: 'platform' })
export class PlatformUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ name: 'password_hash', nullable: true })
  passwordHash: string;

  @Column({ length: 30 })
  role: string; // SUPER_ADMIN | VENDOR_OWNER | VENDOR_STAFF

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
