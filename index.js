/*
Template for V2 interaction
TODO: account interaction (get balance & Swap Tokens)

Sample Output:

DAI/ETH Pair address: 0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11
Token0: 0x6B175474E89094C44Da98b954EedeAC495271d0F
Token1: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
Last Trade TimeStamp: Monday, May 31st, 2021 2:30:06 PM
Total DAI: 43665827.896664996573034514
Total WETH: 16812.404607002050111944
Theo Price_1: 2597.2387006721815
Theo Price_2: 2597.238700672181125015
Amount of Dai for 1 ETH: 2589.293435710513165399
New Mid-Price: 2596.9302246521474

*/

require('dotenv').config()
const express = require('express')
const http = require('http')
const Web3 = require('web3')
const moment = require('moment')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const _ = require('lodash')
const DAI_ABI = require('./abi/Dai.json')

//Token Addresses
const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

//UniswapV2 Contracts
const FACTORY_ABI = require('./abi/UniswapV2Factory.json');
const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';

const UNISWAP_PAIR_ABI = require('./abi/UniswapV2Pair.json'); 
//Pair Addresses UniswapV2Pair.sol
const DAI_ETH = '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11';

const UNISWAP_ROUTER_ABI = require('./abi/UniswapV2Router.json');
const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

//================================================================================================================================
// Server
const PORT = process.env.PORT || 5000
const app = express(); 
const server = http.createServer(app).listen(PORT, () => console.log(`Listening on ${ PORT }`))
//================================================================================================================================
// Web3 
const web3 = new Web3(new HDWalletProvider(process.env.PRIVATE_KEY, process.env.RPC_URL) )
//================================================================================================================================
const factory = new web3.eth.Contract(FACTORY_ABI, FACTORY_ADDRESS);
const v2pair = new web3.eth.Contract(UNISWAP_PAIR_ABI, DAI_ETH);
const router = new web3.eth.Contract(UNISWAP_ROUTER_ABI, ROUTER_ADDRESS)

async function uniswapv2() {

  //grab a specific pair contract address
  const pair = await factory.methods.getPair(DAI_ADDRESS, WETH_ADDRESS).call();
  console.log("DAI/ETH Pair address: "+ pair)

  //TODO: key:value store might make the most sense here
  //returns token address of token0 (Dai)
  const token0 = await v2pair.methods.token0().call()
  //returns token address of token1 (WETH)
  const token1 = await v2pair.methods.token1().call()
  console.log("Token0: " + token0)
  console.log("Token1: " + token1)

  const reserve = await v2pair.methods.getReserves().call()
  /*
    Result {
      '0': '43981169952430305163736284',
      '1': '16674463231828391570503',
      '2': '1622477513',
      _reserve0: '43981169952430305163736284',
      _reserve1: '16674463231828391570503',
      _blockTimestampLast: '1622477513'
    }
  */
  //timestamp of last block inwhich a transaction occurred (in epoch)
  console.log("Last Trade TimeStamp: " + moment.unix(reserve._blockTimestampLast).format('dddd, MMMM Do, YYYY h:mm:ss A'))
  console.log("Total DAI: "+ web3.utils.fromWei(reserve._reserve0, 'ether'))
  console.log("Total WETH: "+ web3.utils.fromWei(reserve._reserve1, 'ether'))
  console.log("Theo Price_1: "+ (reserve._reserve0/reserve._reserve1) )

  const quote = await router.methods.quote(web3.utils.toWei('1', 'ether'),reserve._reserve1, reserve._reserve0 ).call()
  console.log("Theo Price_2: " + web3.utils.fromWei(quote, 'ether'))

  //NOTE: This accounts for fees
  const trade_amount = web3.utils.toWei('1', 'ether')
  const receive = await router.methods.getAmountOut(trade_amount, reserve._reserve1, reserve._reserve0).call()
  console.log("Amount of Dai for 1 ETH: " + web3.utils.fromWei(receive, 'ether'))
  //create new reserve values to see new "theo"
  console.log("New Mid-Price: " + _.divide( _.subtract(_.toNumber(reserve._reserve0),_.toNumber(receive)), _.add(_.toNumber(trade_amount), _.toNumber(reserve._reserve1)) ))

}

uniswapv2();

//================================================================================================================================
