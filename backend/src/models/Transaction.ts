import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn } from 'typeorm';
import { Account } from './Account';
import 'reflect-metadata';

@Entity()
@Index(["transactionId"])
@Index(["account"])
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64 })
  transactionId!: string;

  @Column({ type: "decimal", precision: 18, scale: 2 })
  amount!: number;

  @Column({ type: "varchar", length: 10 })
  assetType!: string;

  @Column({ type: "varchar", length: 255 })
  description!: string;

  @Column({ type: "timestamp" })
  timestamp!: Date;

  @ManyToOne(() => Account, account => account.transactions, { onDelete: "CASCADE" })
  account!: Account;

  @CreateDateColumn()
  createdAt!: Date;
}
