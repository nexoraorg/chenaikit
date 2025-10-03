# Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : has
    ACCOUNT ||--o{ TRANSACTION : records
    USER ||--o{ CREDIT_SCORE : scores
    ACCOUNT ||--o{ CREDIT_SCORE : scores
    USER ||--o{ FRAUD_ALERT : alerts
    ACCOUNT ||--o{ FRAUD_ALERT : alerts
    TRANSACTION ||--o{ FRAUD_ALERT : triggers

    USER {
        uuid id
        string email
        string passwordHash
        string name
        datetime createdAt
        datetime updatedAt
    }
    ACCOUNT {
        uuid id
        string stellarAddress
        string nickname
        uuid userId
        datetime createdAt
        datetime updatedAt
    }
    TRANSACTION {
        uuid id
        string transactionId
        decimal amount
        string assetType
        string description
        datetime timestamp
        uuid accountId
        datetime createdAt
    }
    CREDIT_SCORE {
        uuid id
        uuid userId
        uuid accountId
        int score
        string reason
        datetime createdAt
    }
    FRAUD_ALERT {
        uuid id
        uuid userId
        uuid accountId
        uuid transactionId
        string alertType
        text details
        boolean resolved
        datetime createdAt
    }
```

## Relationships
- User has many Accounts
- Account has many Transactions
- User and Account have many CreditScores
- User, Account, and Transaction have many FraudAlerts

## Indexes
- Unique index on User.email
- Index on Account.stellarAddress
- Index on Transaction.transactionId
- Indexes on foreign keys for fast lookups
