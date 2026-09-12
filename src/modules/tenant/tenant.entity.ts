import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';

@Entity({ name: 'tenants', schema: 'platform' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  slug: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'owner_name', length: 100, nullable: true })
  ownerName: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ length: 15, nullable: true })
  phone: string;

  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ default: 'PENDING' })
  status: string; // PENDING | ACTIVE | SUSPENDED

  @Column({ default: 'STARTER' })
  plan: string; // STARTER | GROWTH | PRO

  @Column({ name: 'schema_name', unique: true, nullable: true })
  schemaName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
