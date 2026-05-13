import type { Hex } from 'viem'

const eip7623BaseGas = 21_000n
const eip7623FloorGasPerToken = 10n
const eip7623ZeroByteTokens = 1n
const eip7623NonZeroByteTokens = 4n
const defaultContractWriteMinimumGas = 100_000n
const defaultContractWriteGasBufferBps = 1_500n
const bpsDenominator = 1_000n

export function getBufferedContractWriteGasLimit({
  data,
  estimatedGas,
  minimumGas = defaultContractWriteMinimumGas
}: {
  data?: Hex
  estimatedGas?: bigint
  minimumGas?: bigint
}) {
  const floorGas = getEip7623FloorGas(data)
  const baseLimit = maxBigInt(floorGas, estimatedGas ?? 0n, minimumGas)

  return (baseLimit * defaultContractWriteGasBufferBps) / bpsDenominator
}

export function getEip7623FloorGas(data?: Hex) {
  if (!data) {
    return eip7623BaseGas
  }

  const hex = data.startsWith('0x') ? data.slice(2) : data
  let calldataTokens = 0n

  for (let index = 0; index < hex.length; index += 2) {
    calldataTokens +=
      hex.slice(index, index + 2) === '00'
        ? eip7623ZeroByteTokens
        : eip7623NonZeroByteTokens
  }

  return eip7623BaseGas + calldataTokens * eip7623FloorGasPerToken
}

export function extractEip7623FloorGasFromError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  const floorMatch = message.match(
    /gas limit below eip-7623 floor:\s*\d+\s*\([^)]*\)\s*<\s*(\d+)/i
  )

  if (!floorMatch?.[1]) {
    return undefined
  }

  try {
    return BigInt(floorMatch[1])
  } catch {
    return undefined
  }
}

function maxBigInt(...values: bigint[]) {
  return values.reduce((currentMax, value) =>
    value > currentMax ? value : currentMax
  )
}
