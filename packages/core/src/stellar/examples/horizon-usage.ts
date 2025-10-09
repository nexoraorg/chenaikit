import { HorizonConnector, HorizonConfig } from '../horizon';

// Example usage of the HorizonConnector
async function demonstrateHorizonUsage() {
  // Configuration for Stellar testnet
  const config: HorizonConfig = {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    apiKey: process.env.STELLAR_API_KEY, // Optional API key for higher rate limits
    rateLimit: {
      requestsPerMinute: 60,
      burstLimit: 10,
      retryAfterMs: 1000
    },
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  };

  // Create Horizon connector instance
  const horizon = new HorizonConnector(config);

  try {
    // Health check
    console.log('Checking Horizon API health...');
    const isHealthy = await horizon.healthCheck();
    console.log(`Horizon API is ${isHealthy ? 'healthy' : 'unhealthy'}`);

    if (!isHealthy) {
      throw new Error('Horizon API is not accessible');
    }

    // Get network information
    console.log('\nFetching network information...');
    const networkInfo = await horizon.getNetworkInfo();
    console.log('Network:', networkInfo.network_passphrase);
    console.log('Protocol Version:', networkInfo.protocol_version);

    // Get fee statistics
    console.log('\nFetching fee statistics...');
    const feeStats = await horizon.getFeeStats();
    console.log('Last Ledger:', feeStats.last_ledger);
    console.log('Last Ledger Base Fee:', feeStats.last_ledger_base_fee);

    // Example account (Stellar Development Foundation test account)
    const testAccount = 'GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J';

    // Get account information
    console.log(`\nFetching account information for ${testAccount}...`);
    const account = await horizon.getAccount(testAccount);
    console.log('Account ID:', account.id);
    console.log('Sequence:', account.sequence);
    console.log('Subentry Count:', account.subentry_count);

    // Get account balances
    console.log('\nFetching account balances...');
    const balances = await horizon.getAccountBalances(testAccount);
    console.log('Balances:');
    balances.forEach((balance, index) => {
      if (balance.asset_type === 'native') {
        console.log(`  ${index + 1}. XLM: ${balance.balance}`);
      } else {
        console.log(`  ${index + 1}. ${balance.asset_code}@${balance.asset_issuer}: ${balance.balance}`);
      }
    });

    // Get recent transactions
    console.log('\nFetching recent transactions...');
    const transactions = await horizon.getAccountTransactions(testAccount, {
      limit: 5,
      order: 'desc'
    });
    console.log(`Found ${transactions.records.length} recent transactions:`);
    transactions.records.forEach((tx, index) => {
      console.log(`  ${index + 1}. Hash: ${tx.hash}`);
      console.log(`     Success: ${tx.successful}`);
      console.log(`     Operations: ${tx.operation_count}`);
      console.log(`     Created: ${new Date(tx.created_at).toLocaleString()}`);
    });

    // Get recent payments
    console.log('\nFetching recent payments...');
    const payments = await horizon.getAccountPayments(testAccount, {
      limit: 5,
      order: 'desc'
    });
    console.log(`Found ${payments.records.length} recent payments:`);
    payments.records.forEach((payment, index) => {
      console.log(`  ${index + 1}. From: ${payment.from}`);
      console.log(`     To: ${payment.to}`);
      console.log(`     Amount: ${payment.amount} ${payment.asset_type === 'native' ? 'XLM' : payment.asset_code}`);
    });

    // Get transaction details (if we have transactions)
    if (transactions.records.length > 0) {
      const firstTx = transactions.records[0];
      console.log(`\nFetching details for transaction ${firstTx.hash}...`);
      
      const txDetails = await horizon.getTransaction(firstTx.hash);
      console.log('Transaction Details:');
      console.log('  Hash:', txDetails.hash);
      console.log('  Source Account:', txDetails.source_account);
      console.log('  Success:', txDetails.successful);
      console.log('  Fee Charged:', txDetails.fee_charged);
      console.log('  Operation Count:', txDetails.operation_count);

      // Get transaction operations
      const operations = await horizon.getTransactionOperations(firstTx.hash);
      console.log(`\nTransaction has ${operations.records.length} operations:`);
      operations.records.forEach((op, index) => {
        console.log(`  ${index + 1}. Type: ${op.type}`);
        console.log(`     Source: ${op.source_account}`);
      });

      // Get transaction effects
      const effects = await horizon.getTransactionEffects(firstTx.hash);
      console.log(`\nTransaction has ${effects.records.length} effects:`);
      effects.records.slice(0, 3).forEach((effect, index) => {
        console.log(`  ${index + 1}. Type: ${effect.type}`);
        console.log(`     Account: ${effect.account}`);
      });
    }

    // Get recent ledgers
    console.log('\nFetching recent ledgers...');
    const ledgers = await horizon.getLedgers({ limit: 3, order: 'desc' });
    console.log(`Found ${ledgers.records.length} recent ledgers:`);
    ledgers.records.forEach((ledger, index) => {
      console.log(`  ${index + 1}. Sequence: ${ledger.sequence}`);
      console.log(`     Hash: ${ledger.hash}`);
      console.log(`     Operations: ${ledger.operation_count}`);
      console.log(`     Closed: ${new Date(ledger.closed_at).toLocaleString()}`);
    });

    // Demonstrate error handling
    console.log('\nTesting error handling...');
    try {
      await horizon.getAccount('INVALID_ADDRESS');
    } catch (error) {
      console.log('✓ Correctly caught invalid address error:', (error as Error).message);
    }

    try {
      await horizon.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
    } catch (error) {
      console.log('✓ Correctly caught non-existent account error:', (error as Error).message);
    }

    console.log('\n✅ All Horizon API operations completed successfully!');

  } catch (error) {
    console.error('❌ Error during Horizon API operations:', error);
  } finally {
    // Clean up
    horizon.stopStreaming();
  }
}

// Example of streaming account updates
async function demonstrateStreaming() {
  const config: HorizonConfig = {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015'
  };

  const horizon = new HorizonConnector(config);
  const testAccount = 'GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J';

  console.log(`\nStarting to stream updates for account ${testAccount}...`);
  
  const streamPromise = horizon.streamAccount(testAccount, (accountData) => {
    console.log(`📊 Account update received:`);
    console.log(`   Sequence: ${accountData.sequence}`);
    console.log(`   Balances: ${accountData.balances.length}`);
    console.log(`   Last Modified: ${new Date(accountData.last_modified_time).toLocaleString()}`);
  });

  // Stream for 10 seconds then stop
  setTimeout(() => {
    console.log('Stopping stream...');
    horizon.stopStreaming();
  }, 10000);

  await streamPromise;
  console.log('Streaming stopped.');
}

// Run examples if this file is executed directly
if (require.main === module) {
  demonstrateHorizonUsage()
    .then(() => demonstrateStreaming())
    .catch(console.error);
}

export { demonstrateHorizonUsage, demonstrateStreaming };
