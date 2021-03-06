/*
 * Testing for ${home}/contract/MultiSig.sol
 */
var assert = require('assert');

var Workbench = require('ethereum-sandbox-workbench');
var workbench = new Workbench();
var sandbox = workbench.sandbox;

var log = console.log;

workbench.startTesting('MultiSig', function(contracts) {
  var creator = '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826';
  var dayLimit;
  var owners = [
      '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826',
      '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392',
      '0xf6adcaf7bbaa4f88a554c45287e2d1ecb38ac5ff'
  ];
  var required = 2;
  var wallet;
  
  /*
    TestCase: test-deploy 
    Description: deploying the contract, 
     validating that the deployment was good.
     The deployed contract will be used for 
     contract call testing in the following 
     test cases
  */
  it('test-deploy', function() {
    dayLimit = sandbox.web3.toWei(0.7, 'ether');
    log(" [test-deploy]");
    return contracts.Wallet.new(owners, required, dayLimit, {
      from: creator
    })
    .then(function(contract) {
      if (contract.address){
        wallet = contract;
      } else {
        throw new Error('No contract address');
      }        
      return true;
    });
  });
  
  
  /*
    TestCase: check-init 
    Description: assert that the initialized owners of 
                 the wallet worked as expected
  */
  it('check-init', function() {
    log(" [check-init]");

    var m_required = wallet.m_required.call()
    assert(m_required.equals(required));
    var m_numOwners = wallet.m_numOwners.call();
    assert(m_numOwners.equals(owners.length + 1));
    return true;
  });
  
  /*
    TestCase: test-deposit
    Description: 
  */
  it('test-deposit', function() {
    log(" [test-deposit]");
    
    return workbench.sendTransaction({
      from: '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392',
      to: wallet.address,
      gas: 200000,
      value: sandbox.web3.toWei(1, 'ether')
    })
    .then(function (txHash) {
      return workbench.waitForReceipt(txHash);
    })
    .then(function (receipt) {
      if (!receipt.logs) throw new Error('No logs in receipt');
      if (receipt.logs.length !== 1) throw new Error('Should have been one log');

      var eventLog = receipt.logs[0];
      var parsed = eventLog.parsed;
      assert(sandbox.web3.eth.getBalance(wallet.address).equals(sandbox.web3.toWei(1, 'ether')));
      assert.equal(parsed.event, 'Deposit');
      assert.equal(parsed.args._from, '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392');
      assert(parsed.args.value.equals(sandbox.web3.toWei(1, 'ether')));
      return true;
    });
  });
 
  /*
    TestCase: test-send-below-daily-limit
    Description: Tests if sending below daily limit executes
                 immediately.
  */
  it('test-send-below-daily-limit', function() {
    log(" [test-send-below-daily-limit]");
    
    var initialAddressBalance = sandbox.web3.eth.getBalance('0xdedb49385ad5b94a16f236a6890cf9e0b1e30392');
    return wallet.execute(
      '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392', 
      sandbox.web3.toWei(0.4, 'ether'),
      null, {
      from: '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826',
      gas: 500000
    })
    .then(function(txHash) {
      // we are waiting for blockchain to accept the transaction 
      return workbench.waitForReceipt(txHash);
    })
    .then(function(receipt) {
        if (!receipt.logs) throw new Error('No logs in receipt');
        if (receipt.logs.length !== 1) throw new Error('Should have been one log');
        var eventLog = receipt.logs[0];
        var parsed = eventLog.parsed;
        assert.equal(parsed.event, 'SingleTransact');
        assert(sandbox.web3.eth.getBalance(wallet.address).equals(sandbox.web3.toWei(0.6, 'ether')));
        assert(sandbox.web3.eth.getBalance('0xdedb49385ad5b94a16f236a6890cf9e0b1e30392').minus(sandbox.web3.toWei(0.4, 'ether')).equals(initialAddressBalance));
        assert(parsed.args.value.equals(sandbox.web3.toWei(0.4, 'ether')));
        assert.equal(parsed.args.owner, '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826');
        assert.equal(parsed.args.to, '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392');
        return true;
    });
  });
    
  /*
    TestCase: test-confirmation-needed
    Description: If the value is over the daily limit,
                 event ConfirmationNeeded should be
                 emitted
  */

  var confirmationNeededHash;
  it('test-confirmation-needed', function() {
    log(" [test-confirmation-needed]");
    
    var initialAddressBalance = sandbox.web3.eth.getBalance('0xdedb49385ad5b94a16f236a6890cf9e0b1e30392');
    return wallet.execute(
      '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392', 
      sandbox.web3.toWei(0.5, 'ether'),
      null, {
      from: '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826',
      gas: 500000
    })
    .then(function(txHash) {
      return workbench.waitForReceipt(txHash);
    })
    .then(function(receipt) {
        if (!receipt.logs) throw new Error('No logs in receipt');
        if (receipt.logs.length !== 2) throw new Error('Should have been two logs');
        var confirmedEventLog = receipt.logs[0].parsed;
        var confirmationNeededEventLog = receipt.logs[1].parsed;
        assert.equal(confirmedEventLog.event, 'Confirmation');
        assert.equal(confirmationNeededEventLog.event, 'ConfirmationNeeded');
        assert(sandbox.web3.eth.getBalance(wallet.address).equals(sandbox.web3.toWei(0.6, 'ether')));
        assert(sandbox.web3.eth.getBalance('0xdedb49385ad5b94a16f236a6890cf9e0b1e30392').equals(initialAddressBalance));
        assert.equal(confirmedEventLog.args.owner, '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826');
        assert(confirmationNeededEventLog.args.value.equals(sandbox.web3.toWei(0.5, 'ether')));
        assert.equal(confirmationNeededEventLog.args.initiator, '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826');
        assert.equal(confirmationNeededEventLog.args.to, '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392');
        confirmationNeededHash = confirmationNeededEventLog.args.operation;
        return true;
    });
  });


  /*
    TestCase: test-multi-transact
    Description: confirm using another address
                 and notice the values chance.
  */
  it('test-multi-transact', function() {
    log(" [test-multi-transact]");

    if (!confirmationNeededHash) {
      return Promise.reject(new Error('Can\'t test multi transact without a confirmationNeededHash'));
    }
    
    var initialAddressBalance = sandbox.web3.eth.getBalance('0xdedb49385ad5b94a16f236a6890cf9e0b1e30392');
    return wallet.confirm(
      confirmationNeededHash, {
      from: '0xf6adcaf7bbaa4f88a554c45287e2d1ecb38ac5ff',
      gas: 500000
    })
    .then(function(txHash) {
      return workbench.waitForReceipt(txHash);
    })
    .then(function(receipt) {
        if (!receipt.logs) throw new Error('No logs in receipt');
        if (receipt.logs.length !== 2) throw new Error('Should have been two logs');
        var confirmedEventLog = receipt.logs[0].parsed;
        var multiTransactEventLog = receipt.logs[1].parsed;
        assert.equal(confirmedEventLog.event, 'Confirmation');
        assert.equal(multiTransactEventLog.event, 'MultiTransact');
        assert(sandbox.web3.eth.getBalance(wallet.address).equals(sandbox.web3.toWei(0.1, 'ether')));
        assert(sandbox.web3.eth.getBalance('0xdedb49385ad5b94a16f236a6890cf9e0b1e30392').minus(sandbox.web3.toWei(0.5)).equals(initialAddressBalance));
        assert.equal(confirmedEventLog.args.owner, '0xf6adcaf7bbaa4f88a554c45287e2d1ecb38ac5ff');
        assert.equal(multiTransactEventLog.args.owner, '0xf6adcaf7bbaa4f88a554c45287e2d1ecb38ac5ff');
        assert(multiTransactEventLog.args.value.equals(sandbox.web3.toWei(0.5, 'ether')));
        assert.equal(multiTransactEventLog.args.to, '0xdedb49385ad5b94a16f236a6890cf9e0b1e30392');
        return true;
    });
  });
});
