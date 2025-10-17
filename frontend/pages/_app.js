import '../styles/globals.css'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet, goerli, localhost } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [localhost, goerli, mainnet],
  [publicProvider()]
)

const { connectors } = getDefaultWallets({
  appName: 'ZK Marketplace',
  projectId: 'your-project-id',
  chains
})

const config = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})

function MyApp({ Component, pageProps }) {
  return (
    <WagmiConfig config={config}>
      <RainbowKitProvider chains={chains}>
        <Component {...pageProps} />
      </RainbowKitProvider>
    </WagmiConfig>
  )
}

export default MyApp

