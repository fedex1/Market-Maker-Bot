const ethers = require('ethers');
require("dotenv").config();

// const pKey = new ethers.Wallet.createRandom();
// console.log(pKey);
/*
sepolia v3 addresses I found
UniversalRouter: 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD
swap router: 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
v3CoreFactoryAddress: 0x0227628f3F023bb0B980b67D528571c95c6DaC1c
multicallAddress: 0xD7F33bCdb21b359c8ee6F0251d30E94832baAd07
quoterAddress: 0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3
v3MigratorAddress: 0x729004182cF005CEC8Bd85df140094b6aCbe8b15
nonfungiblePositionManagerAddress: 0x1238536071E1c677A632429e3655c799b22cDA52
tickLensAddress: 0xd7f33bcdb21b359c8ee6f0251d30e94832baad07
WETH: 0xfff9976782d46cc05630d1f6ebab18b2324d6b14
USD: 0x6f14C02Fc1F78322cFd7d707aB90f18baD3B54f5
*/

if (true){
// const wethAddress = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'; // goerli weth
// const wethAddress = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'; // sepolia weth
const wethAddress = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14'; // sepolia weth
// 0xfff9976782d46cc05630d1f6ebab18b2324d6b14
// const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // mainnet weth

// const routerAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // Uniswap Router
const routerAddress = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E';

// const quoterAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'; // Uniswap Quoter
const quoterAddress= '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3';

// const tokenAddress = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'; // goerli uni
const tokenAddress = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'; // sepolia uni

// 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984
const fee = 3000; // Uniswap pool fee bps 500, 3000, 10000
const buyAmount = ethers.parseUnits('0.001', 'ether');
const targetPrice = BigInt(35); // target exchange rate
const targetAmountOut = buyAmount * targetPrice;
const sellAmount = buyAmount / targetPrice;
const tradeFrequency = 3600 * 1000; // ms (once per hour)

// `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`
// https://eth-sepolia.g.alchemy.com/v2/5Esb7DbpCMSGDYF2Gb49NnQrYzc6h0bQ
// const provider = new ethers.JsonRpcProvider(`https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`);
const provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
const account = wallet.connect(provider);

const token = new ethers.Contract(
  tokenAddress,
  [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) public view returns (uint256)',
  ],
  account
);

const router = new ethers.Contract(
  routerAddress,
  ['function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'],
  account
);

const quoter = new ethers.Contract(
  quoterAddress,
  ['function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) public view returns (uint256 amountOut)'],
  account
);

const buyTokens = async () => {
  console.log('Buying Tokens')
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await router.exactInputSingle([wethAddress, tokenAddress, fee, wallet.address, deadline, buyAmount, 0, 0], {value: buyAmount});
  await tx.wait();
  console.log(tx.hash);
}

const sellTokens = async () => {
  console.log('Selling Tokens')
  const allowance = await token.allowance(wallet.address, routerAddress);
  console.log(`Current allowance: ${allowance}`);
  if (allowance < sellAmount) {
    console.log('Approving Spend (bulk approve in production)');
    const atx = await token.approve(routerAddress, sellAmount);
    await atx.wait();
  }
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await router.exactInputSingle([tokenAddress, wethAddress, fee, wallet.address, deadline, sellAmount, 0, 0]);
  await tx.wait();
  console.log(tx.hash);
}

const checkPrice = async () => {
  const amountOut = await quoter.quoteExactInputSingle(wethAddress, tokenAddress, fee, buyAmount, 0);
  console.log(`Current Exchange Rate: ${amountOut.toString()}`);
  console.log(`Target Exchange Rate: ${targetAmountOut.toString()}`);
  if (amountOut < targetAmountOut) buyTokens();
  if (amountOut > targetAmountOut) sellTokens();
}

checkPrice();
setInterval(() => {
  checkPrice();
}, tradeFrequency);
}
