'use strict'

const Libp2p = require('libp2p')

const WebRTCStar = require('libp2p-webrtc-star')
const WebSockets = require('libp2p-websockets')
const WebSocketStar = require('libp2p-websocket-star')
const Multiplex = require('libp2p-mplex')
const SPDY = require('libp2p-spdy')
const SECIO = require('libp2p-secio')
const Bootstrap = require('libp2p-bootstrap')
const Protector = require('libp2p-pnet')
const KadDHT = require('libp2p-kad-dht')

const GossipSub = require('libp2p-gossipsub')

const pLibp2pBundle = (swarmKey) => {
  /**
   * This is the bundle we will use to create our fully customized libp2p bundle.
   * @param {libp2pBundle~options} opts The options to use when generating the libp2p node
   * @returns {Libp2p} Our new libp2p node
   */
  const libp2pBundle = (opts) => {
    // Set convenience variables to clearly showcase some of the useful things that are available
    const peerInfo = opts.peerInfo
    const peerBook = opts.peerBook
    const bootstrapList =opts.config.Bootstrap

    const wrtcStar = new WebRTCStar({ id: peerInfo.id })
    const wsstar = new WebSocketStar({ id: peerInfo.id })

    // Build and return our libp2p node
    return new Libp2p({
      peerInfo,
      peerBook,
      modules: {
        transport: [
          wrtcStar,
          WebSockets,
          wsstar
        ],
        streamMuxer: [
          Multiplex,
          SPDY
        ],
        connEncryption: [
          SECIO
        ],
        peerDiscovery: [
          wrtcStar.discovery,
          wsstar.discovery,
          Bootstrap
          //MDNS
        ],
        dht: KadDHT,
       // pubsub: GossipSub,
        connProtector: new Protector(swarmKey)
      },
      config: {
        peerDiscovery: {
          autoDial: true,
          mdns:{
            interval: 1000,
            enabled: true
          },
          bootstrap: {
            interval: 20e3,
            enabled: true,
            list: bootstrapList
          },
          webRTCStar: {
            enabled: true
          },
          websocketStar: {
            enabled: true
          }
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: true
          }
        },
        dht: {
          kBucketSize: 20,
          enabled: false,
          randomWalk: {
            enabled: false
          }
        },
        EXPERIMENTAL: {
          pubsub: true
        }
      },
      connectionManager: {
        minPeers: 10,
        maxPeers: 50
      }
    })
  }

  return libp2pBundle
}

module.exports = pLibp2pBundle
