/*
Template for V2 interaction

Sample Output of UniswapV2():

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

TODO: Create TokenToEth Transaction type (label functions properly)
TODO: Make swap functions take inputs to make them more robust

*/
require('dotenv').config()
const Web3 = require('web3')
const moment = require('moment')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const _ = require('lodash')

//abis
const FACTORY_ABI = require('./abi/UniswapV2Factory.json')
const UNISWAP_PAIR_ABI = require('./abi/UniswapV2Pair.json')
const UNISWAP_ROUTER_ABI = require('./abi/UniswapV2Router.json')
const LINK_ABI = require('./abi/LinkToken.json')

//Ropsten Addresses
const LINK_ADDRESS = '0x20fe562d797a42dcb3399062ae9546cd06f63280'
const WETH_ADDRESS = '0xc778417E063141139Fce010982780140Aa0cD5Ab'
const LINK_ETH = '0x98A608D3f29EebB496815901fcFe8eCcC32bE54a'
const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

//web3
const web3 = new Web3(new HDWalletProvider(process.env.PRIVATE_KEY, process.env.RPC_URL_ROPSTEN) )
var BN = web3.utils.BN

//contracts
const factory = new web3.eth.Contract(FACTORY_ABI, FACTORY_ADDRESS)
const v2pair = new web3.eth.Contract(UNISWAP_PAIR_ABI, LINK_ETH)
const router = new web3.eth.Contract(UNISWAP_ROUTER_ABI, ROUTER_ADDRESS)
const link = new web3.eth.Contract(LINK_ABI, LINK_ADDRESS)

//variables
const eth_trade_amount = web3.utils.toWei('.01', 'ether')
const token_trade_amount = web3.utils.toWei('.02', 'ether')
const account = process.env.ACCOUNT
const gasPrice = '50'//Gwei
const gasLimit = 8000000
//Slippage is hard coded to 1%


async function uniswapv2() {
  //grab a specific pair contract address
  const pair = await factory.methods.getPair(LINK_ADDRESS, WETH_ADDRESS).call()
  console.log("LINK/ETH Pair address: "+ pair)
  //returns token address of token0 (Dai)
  const token0 = await v2pair.methods.token0().call()
  //returns token address of token1 (WETH)
  const token1 = await v2pair.methods.token1().call()
  console.log("Token0: " + token0)
  console.log("Token1: " + token1)

  const reserve = await v2pair.methods.getReserves().call()
  //console.log(reserve)
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
  console.log("Total LINK: "+ web3.utils.fromWei(reserve._reserve0, 'ether'))
  console.log("Total WETH: "+ web3.utils.fromWei(reserve._reserve1, 'ether'))
  console.log("Theo Price_1: "+ (reserve._reserve0/reserve._reserve1) )

  const quote = await router.methods.quote(web3.utils.toWei('1', 'ether'),reserve._reserve1, reserve._reserve0 ).call()
  console.log("Theo Price_2: " + web3.utils.fromWei(quote, 'ether'))

  //NOTE: This accounts for fees
  const receive = await router.methods.getAmountOut(eth_trade_amount, reserve._reserve1, reserve._reserve0).call()
  console.log("Amount of LINK for .01 ETH: " + web3.utils.fromWei(receive, 'ether'))
  //create new reserve values to see new "theo"
  console.log("New Mid-Price: " + _.divide( _.subtract(_.toNumber(reserve._reserve0),_.toNumber(receive)), _.add(_.toNumber(eth_trade_amount), _.toNumber(reserve._reserve1)) ))
}

async function balance() {
  let balance
  balance = await web3.eth.getBalance(account)
  balance = web3.utils.fromWei(balance, 'Ether')
  console.log("Ether Balance:", balance)
  balance = await link.methods.balanceOf(account).call()
  balance = web3.utils.fromWei(balance, 'Ether')
  console.log("Link Balance:", balance)
}

async function SwapEthForToken() {
  const now = moment().unix() //current unix timestamp
  const deadline = now + 60 //add 60 seconds
  // Transaction Settings
  const settings = {
    gasLimit: gasLimit,
    gasPrice: web3.utils.toWei(gasPrice, 'Gwei'),
    from: account, 
    value: eth_trade_amount 
  }
  //grab preTrade impact
  const reserve = await v2pair.methods.getReserves().call()
  const AmountOut = await router.methods.getAmountOut(eth_trade_amount, reserve._reserve1, reserve._reserve0).call()
  //reduce by slippage allowance (1%))
  const amountOutMin = new BN(AmountOut).mul(new BN(99)).div(new BN(100)).toString()
  const path = [WETH_ADDRESS, LINK_ADDRESS]
  const to = account
  console.log('Performing swap...')
  await router.methods.swapExactETHForTokens(
    amountOutMin,
    path,
    to,
    deadline
  ).send(settings).on('transactionHash', (hash => {
    console.log('Transaction Hash: ' + hash)
  })).then ((receipt) => {
    console.log("Transaction Complete!")
    let gasUsed = new BN(receipt.gasUsed).mul(new BN(gasPrice)).toString()
    console.log('Total Gas Used: ' + web3.utils.fromWei(gasUsed,'Gwei') + " ETH")
  })
}

async function SwapTokenForEth() {
  const now = moment().unix() //current unix timestamp
  const deadline = now + 60 //add 60 seconds
  // Transaction Settings
  const settings = {
    gasLimit: gasLimit,
    gasPrice: web3.utils.toWei(gasPrice, 'Gwei'),
    from: account
  }
  //grab preTrade impact
  const reserve = await v2pair.methods.getReserves().call()
  const AmountOut = await router.methods.getAmountOut(token_trade_amount, reserve._reserve0, reserve._reserve1).call()
  //reduce by slippage allowance 1%
  const amountOutMin = new BN(AmountOut).mul(new BN(80)).div(new BN(100)).toString()
  const path = [LINK_ADDRESS, WETH_ADDRESS]
  const to = account
  console.log('Performing swap...')
  await router.methods.swapExactTokensForETH(
    token_trade_amount,
    amountOutMin,
    path,
    to,
    deadline
  ).send(settings).on('transactionHash', (hash => {
    console.log('Transaction Hash: ' + hash)
  })).then ((receipt) => {
    console.log("Transaction Complete!")
    let gasUsed = new BN(receipt.gasUsed).mul(new BN(gasPrice)).toString()
    console.log('Total Gas Used: ' + web3.utils.fromWei(gasUsed,'Gwei') + " ETH")
  })
}

async function ApproveTokenSwap() {
  await link.methods.approve(LINK_ETH, token_trade_amount).send({from: account}).then((receipt) => {
    console.log("Approve for Transfer...")
  }) 
}

//uniswapv2()
//balance()
//SwapEthForToken()
SwapTokenForEth()


