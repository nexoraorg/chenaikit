import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import 'reflect-metadata';
import { User } from './User';
import { Transaction } from './Transaction';

@Entity()
@Index(['stellarAddress'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 56 })
  stellarAddress!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nickname?: string;

  @ManyToOne(() => User, user => user.accounts, { onDelete: 'CASCADE' })
  user!: User;

  @OneToMany(() => Transaction, transaction => transaction.account)
  transactions!: Transaction[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
