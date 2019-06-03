/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // New block height
           block.height = self.chain.length;
           // New Block previousBlockHash if not Genesis block
           if (block.height > 0){
               block.previousBlockHash = self.chain[self.chain.length-1].hash;
           }
           // UTC Timestamp in seconds
            block.time = new Date().getTime().toString().slice(0,-3);
            // Block hash with SHA256 using newBlock and converting to a string
            // !! At the time of hashing the block its hash property is still null
            block.hash = SHA256(JSON.stringify(block)).toString();
            self.chain.push(block);
            self.height = self.chain.length;
            resolve(block);
            reject(Error("Error: Cound not add block to the chain"));
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            // Return the message to be signed as "address:timestamp:starRegistry"
            resolve(`${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`)
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            
            let messageTime = parseInt(message.split(':')[1]);
            let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));

            // Check message time must be less than 5 minutes since signature
            if (currentTime - messageTime < 5*60){
                // Check message was signed by the address
                if (bitcoinMessage.verify(message, address, signature)){
                    // Creates body with owner and its star
                    let inputBody = {"owner":address,"star":star};
                    // Creates new block with the star registry and adds it to the chain
                    let newBlock = new BlockClass.Block(inputBody);
                    await self._addBlock(newBlock);
                    resolve(newBlock);
                }else{
                    reject(Error("Signature verification Error"));
                }
            }else{
                reject(Error("Message is outdated"));
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(b => b.hash==hash)
            if(block){
                resolve(block);
            }else{
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];

        return new Promise((resolve, reject) => {
            self.chain.forEach(block => {
                block.getBData().then(function(body) {
                    if (body.owner == address){
                        stars.push(body);
                    }     
                });
            });
            resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = []; // will be true if the block hash is chained AND the block is valid

        return new Promise(async (resolve, reject) => {
            
            // iterates over the blockchain
            await self.chain.forEach(block => {

                // if genesis block, previousBlockHash should be null - AND - block.validate() should be true
                if (block.height == 0) {
                    block.validate().then((result) => errorLog.push(result & (block.previousBlockHash == null) ));
                
                // checks PreviousBlockHash attribute of the current block with the hash attribute of the previous block
                // AND current block.validate() is true
                } else if (block.height>0) {
                    self.getBlockByHeight(block.height-1).then((prevBlock) => {
                    block.validate().then((result) => errorLog.push(result & (block.previousBlockHash==prevBlock.hash)));
                    }); 
                }
            });
            resolve(errorLog);           
        });
    }

}

module.exports.Blockchain = Blockchain;   