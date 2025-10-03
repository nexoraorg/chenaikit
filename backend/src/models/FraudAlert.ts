import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn } from 'typeorm';
import { User } from './User';
import { Account } from './Account';
import { Transaction } from './Transaction';

@Entity()
@Index(['user'])
@Index(['account'])
@Index(['transaction'])
export class FraudAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: true })
  account?: Account;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE', nullable: true })
  transaction?: Transaction;

  @Column({ type: 'varchar', length: 255 })
  alertType!: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'boolean', default: false })
  resolved!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
