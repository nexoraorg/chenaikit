import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitModels001 implements MigrationInterface {
  name = 'InitModels001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user" (
      "id" uuid PRIMARY KEY,
      "email" varchar(255) NOT NULL UNIQUE,
      "passwordHash" varchar(255) NOT NULL,
      "name" varchar(100),
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE "account" (
      "id" uuid PRIMARY KEY,
      "stellarAddress" varchar(56) NOT NULL,
      "nickname" varchar(255),
      "userId" uuid,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "FK_user_account" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_stellarAddress" ON "account" ("stellarAddress")`);
    await queryRunner.query(`CREATE TABLE "transaction" (
      "id" uuid PRIMARY KEY,
      "transactionId" varchar(64) NOT NULL,
      "amount" decimal(18,2) NOT NULL,
      "assetType" varchar(10) NOT NULL,
      "description" varchar(255) NOT NULL,
      "timestamp" TIMESTAMP NOT NULL,
      "accountId" uuid,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "FK_account_transaction" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_transactionId" ON "transaction" ("transactionId")`);
    await queryRunner.query(`CREATE TABLE "credit_score" (
      "id" uuid PRIMARY KEY,
      "userId" uuid,
      "accountId" uuid,
      "score" int NOT NULL,
      "reason" varchar(255),
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "FK_user_creditscore" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_account_creditscore" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "fraud_alert" (
      "id" uuid PRIMARY KEY,
      "userId" uuid,
      "accountId" uuid,
      "transactionId" uuid,
      "alertType" varchar(255) NOT NULL,
      "details" text,
      "resolved" boolean DEFAULT false,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "FK_user_fraudalert" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_account_fraudalert" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_transaction_fraudalert" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fraud_alert"`);
    await queryRunner.query(`DROP TABLE "credit_score"`);
    await queryRunner.query(`DROP INDEX "IDX_transactionId"`);
    await queryRunner.query(`DROP TABLE "transaction"`);
    await queryRunner.query(`DROP INDEX "IDX_stellarAddress"`);
    await queryRunner.query(`DROP TABLE "account"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
