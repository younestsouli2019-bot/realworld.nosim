export async function broadcastCrypto(transactions) {
  const url = process.env.CRYPTO_RPC_URL;
  const key = process.env.CRYPTO_PRIVATE_KEY;
  const rate = Number(process.env.CRYPTO_USD_TO_ETH_RATE || 0);
  if (!url || !key) return { status: 'missing_config' };
  let ethersLib = null;
  try {
    ethersLib = await import('ethers');
  } catch {
    return { status: 'missing_dependency', dependency: 'ethers' };
  }
  const { ethers } = ethersLib;
  const provider = new ethers.JsonRpcProvider(url);
  const wallet = new ethers.Wallet(key, provider);
  const results = [];
  for (const t of transactions) {
    const usd = Number(t.amount || 0);
    if (!rate || !usd) return { status: 'missing_rate' };
    const eth = usd / rate;
    const value = ethers.parseEther(String(eth));
    const tx = { to: t.destination, value };
    const sent = await wallet.sendTransaction(tx);
    results.push({ hash: sent.hash });
  }
  return { status: 'sent', results };
}

