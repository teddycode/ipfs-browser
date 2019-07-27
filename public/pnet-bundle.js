'use strict'

const Libp2p = require('libp2p')
const WS = require('libp2p-websockets')
const TCP = require('libp2p-tcp')
const Multiplex = require('pull-mplex')
const SECIO = require('libp2p-secio')
const Protector = require('libp2p-pnet')
const Bootstrap = require('libp2p-bootstrap')
const KadDHT = require('libp2p-kad-dht')
const WebSocketStarMulti = require('libp2p-websocket-star-multi')
const multiaddr = require('multiaddr')
const WebRTCStar = require('libp2p-webrtc-star')
/**
 * Options for the libp2p bundle
 * @typedef {Object} libp2pBundle~options
 * @property {PeerInfo} peerInfo - The PeerInfo of the IPFS node
 * @property {PeerBook} peerBook - The PeerBook of the IPFS node
 * @property {Object} config - The config of the IPFS node
 * @property {Object} options - The options given to the IPFS node
 */

/**
 * privateLibp2pBundle returns a libp2p bundle function that will use the swarm
 * key at the given `swarmKey` to create the Protector
 *
 * @param {string} swarmKey The path to our swarm key
 * @returns {libp2pBundle} Returns a libp2pBundle function for use in IPFS creation
 */
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

    const wrtcstar = new WebRTCStar({ id: peerInfo.id })
    // const wsstar = new WebSocketStar({ id: peerInfo.id })
    const wsstarServers = peerInfo.multiaddrs.toArray().map(String).filter(addr => addr.includes('p2p-websocket-star'))
    peerInfo.multiaddrs.replace(wsstarServers.map(multiaddr), '/p2p-websocket-star') // the ws-star-multi module will replace this with the chosen ws-star servers
    const wsstar = new WebSocketStarMulti({ servers: wsstarServers, id: peerInfo.id, ignore_no_online: !wsstarServers.length || opts.wsStarIgnoreErrors })

    // Build and return our libp2p node
    return new Libp2p({
      peerInfo,
      peerBook,
      modules: {
        transport: [
          WS,
          wrtcstar,
          wsstar
        ],
        streamMuxer: [
          Multiplex
        ],
        connEncryption: [
          SECIO
        ],
        peerDiscovery: [
            wrtcstar.discovery,
            wsstar.discovery,
            Bootstrap
          ],
          dht: KadDHT,
        connProtector: new Protector(swarmKey)
      },
      config: {
        peerDiscovery: {
          autoDial: true,
          bootstrap: {
            enabled: true
          },
          webRTCStar: {
            enabled: true
          },
          websocketStar: {
            enabled: true
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
      }
    })
  }

  return libp2pBundle
}

module.exports = pLibp2pBundle
