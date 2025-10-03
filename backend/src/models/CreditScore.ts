import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn } from 'typeorm';
import 'reflect-metadata';
import { User } from './User';
import { Account } from './Account';

@Entity()
@Index(['user'])
@Index(['account'])
export class CreditScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: true })
  account?: Account;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
