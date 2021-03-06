/* global location */
'use strict'

const IPFS = require('ipfs')

// Libp2p 
const pLibp2pBundle = require('./pnet-bundle.js')
const repo = 'ipfs-repo'
const swarmKey = '/key/swarm/psk/1.0.0/\n/base16/\n826db2396724c0619a8deb0430c77a3f4af0ed4086785b5e2d5e8f2b13bcd0f4'

// Node
const $nodeId = document.querySelector('.node-id')
const $nodeAddresses = document.querySelector('.node-addresses')
const $logs = document.querySelector('#logs')
// Peers
const $peers = document.querySelector('#peers')
const $peersList = $peers.querySelector('tbody')
const $multiaddrInput = document.querySelector('#multiaddr-input')
const $connectButton = document.querySelector('#peer-btn')
// Files
const $cidInput = document.querySelector('#cid-input')
const $fetchButton = document.querySelector('#fetch-btn')
const $dragContainer = document.querySelector('#drag-container')
const $progressBar = document.querySelector('#progress-bar')
const $fileHistory = document.querySelector('#file-history tbody')
const $emptyRow = document.querySelector('.empty-row')
// Misc
const $allDisabledButtons = document.querySelectorAll('button:disabled')
const $allDisabledInputs = document.querySelectorAll('input:disabled')
const $allDisabledElements = document.querySelectorAll('.disabled')

// Workspace inputs
const $workspaceInput = document.querySelector('#workspace-input')
const $workspaceBtn = document.querySelector('#workspace-btn')

let FILES = []
//let workspace = location.hash

let workspace = 'testWorkspace'

console.log('workespace:', workspace)

let fileSize = 0

let node
let info
const { Buffer } = IPFS  // ES6

/* ===========================================================================
   Start the IPFS node
   =========================================================================== */

async function start() {
  //if (!node) {
  const options = {
    EXPERIMENTAL: {
      pubsub: true
    },
    libp2p: pLibp2pBundle(swarmKey),
    repo: repo,
    preload: {
      enabled: false,
      addresses: [
        '/dns4/guetdcl.cn/tcp/8082/https/ipfs/QmXt4bwenzr8apvhE1Lkn2HjKcdT5EZppk5P1TK9rr8B9v'
      ]
    },
    config: {
      Addresses: {
        //API: ['/ip4/127.0.0.1/tcp/5002'],
        Swarm: [
          '/dns4/guetdcl.cn/tcp/8083/wss/p2p-webrtc-star/'
        ]
      },
      Bootstrap: [
        '/dns4/guetdcl.cn/tcp/8082/wss/ipfs/QmXt4bwenzr8apvhE1Lkn2HjKcdT5EZppk5P1TK9rr8B9v'
      ],
      Discovery: {
        MDNS: {
          Enabled: false,
          Interval: 10
        }
      }
    }
  }
  node = await IPFS.create(options)

  try {
    info = await node.id()
    updateView('ready', node)
  } catch (err) {
    return onError(err)
  }

  onSuccess('Node is ready.')

  setInterval(async () => {
    try {
      await refreshPeerList()
    } catch (err) {
      err.message = `Failed to refresh the peer list: ${err.message}`
      onError(err)
    }
  }, 1000)

  setInterval(async () => {
    try {
      await sendFileList()
    } catch (err) {
      err.message = `Failed to publish the file list: ${err.message}`
      onError(err)
    }
  }, 10000)

  try {
    await subscribeToWorkpsace()
  } catch (err) {
    err.message = `Failed to subscribe to the workspace: ${err.message}`
    return onError(err)
  }

  window.addEventListener('hashchange', async () => {
    try {
      await workspaceUpdated()
    } catch (err) {
      err.message = `Failed to subscribe to the updated workspace: ${err.message}`
      onError(err)
    }
  })
}

/* ===========================================================================
   Pubsub
   =========================================================================== */

const messageHandler = (message) => {
  const myNode = info.id
  const hash = message.data.toString()
  const messageSender = message.from

  // append new files when someone uploads them
  if (myNode !== messageSender && !FILES.includes(hash)) {
    $cidInput.value = hash
    getFile()
  }
}

const subscribeToWorkpsace = async () => {
  await node.pubsub.subscribe(workspace, messageHandler)
  const msg = `Subscribed to workspace ${workspace}`
  $logs.innerHTML = msg
}

// unsubscribe from old workspace and re-subscribe to new one
const workspaceUpdated = async () => {
  await node.pubsub.unsubscribe(workspace)
  // clear files from old workspace
  FILES = []
  $fileHistory.innerHTML = ''

  workspace = location.hash
  await subscribeToWorkpsace()
}

const publishHash = (hash) => {
  const data = Buffer.from(hash)
  return node.pubsub.publish(workspace, data)
}

/* ===========================================================================
   Files handling
   =========================================================================== */

const sendFileList = () => Promise.all(FILES.map(publishHash))

const updateProgress = (bytesLoaded) => {
  let percent = 100 - ((bytesLoaded / fileSize) * 100)

  $progressBar.style.transform = `translateX(${-percent}%)`
}

const resetProgress = () => {
  $progressBar.style.transform = 'translateX(-100%)'
}

function appendFile(name, hash, size, data) {
  const file = new window.Blob([data], { type: 'application/octet-binary' })
  const url = window.URL.createObjectURL(file)
  const row = document.createElement('tr')

  const nameCell = document.createElement('td')
  nameCell.innerHTML = name

  const hashCell = document.createElement('td')
  hashCell.innerHTML = hash

  const sizeCell = document.createElement('td')
  sizeCell.innerText = size

  const downloadCell = document.createElement('td')
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', name)
  link.innerHTML = '<img width=20 class="table-action" src="assets/download.svg" alt="Download" />'
  downloadCell.appendChild(link)

  row.appendChild(nameCell)
  row.appendChild(hashCell)
  row.appendChild(sizeCell)
  row.appendChild(downloadCell)

  $fileHistory.insertBefore(row, $fileHistory.firstChild)

  return publishHash(hash)
}

async function getFile() {
  const hash = $cidInput.value

  $cidInput.value = ''

  if (!hash) {
    return onError('No CID was inserted.')
  } else if (FILES.includes(hash)) {
    return onSuccess('The file is already in the current workspace.')
  }

  FILES.push(hash)

  const files = await node.get(hash)

  return Promise.all(files.map(async (file) => {
    if (file.content) {
      await appendFile(file.name, hash, file.size, file.content)
      onSuccess(`The ${file.name} file was added.`)
      $emptyRow.style.display = 'none'
    }
  }))
}

/* Drag & Drop
   =========================================================================== */

const onDragEnter = () => $dragContainer.classList.add('dragging')

const onDragLeave = () => $dragContainer.classList.remove('dragging')

async function onDrop(event) {
  onDragLeave()
  event.preventDefault()

  const files = Array.from(event.dataTransfer.files)

  for (const file of files) {
    fileSize = file.size // Note: fileSize is used by updateProgress

    const filesAdded = await node.add({
      path: file.name,
      content: file
    }, { wrapWithDirectory: true, progress: updateProgress })

    // As we are wrapping the content we use that hash to keep
    // the original file name when adding it to the table
    $cidInput.value = filesAdded[1].hash

    resetProgress()
    await getFile()
  }
}

/* ===========================================================================
   Peers handling
   =========================================================================== */

async function connectToPeer(event) {
  const multiaddr = $multiaddrInput.value

  if (!multiaddr) {
    throw new Error('No multiaddr was inserted.')
  }

  await node.swarm.connect(multiaddr)

  onSuccess(`Successfully connected to peer.`)
  $multiaddrInput.value = ''
}

async function refreshPeerList() {
  const peers = await node.swarm.peers()

  const peersAsHtml = peers.reverse()
    .map((peer) => {
      if (peer.addr) {
        const addr = peer.addr.toString()
        if (addr.indexOf('ipfs') >= 0) {
          return addr
        } else {
          return addr + peer.peer.id.toB58String()
        }
      }
    })
    .map((addr) => {
      return `<tr><td>${addr}</td></tr>`
    }).join('')

  $peersList.innerHTML = peersAsHtml
}

/* ===========================================================================
   Error handling
   =========================================================================== */

function onSuccess(msg) {
  $logs.classList.add('success')
  $logs.innerHTML = msg
}

function onError(err) {
  console.log(err)
  let msg = 'An error occured, check the dev console'

  if (err.stack !== undefined) {
    msg = err.stack
  } else if (typeof err === 'string') {
    msg = err
  }

  $logs.classList.remove('success')
  $logs.innerHTML = msg
}

window.onerror = onError

/* ===========================================================================
   App states
   =========================================================================== */

const states = {
  ready: () => {
    const addressesHtml = info.addresses.map((address) => {
      return `<li><pre>${address}</pre></li>`
    }).join('')
    $nodeId.innerText = info.id
    $nodeAddresses.innerHTML = addressesHtml
    $allDisabledButtons.forEach(b => { b.disabled = false })
    $allDisabledInputs.forEach(b => { b.disabled = false })
    $allDisabledElements.forEach(el => { el.classList.remove('disabled') })
  }
}

function updateView(state, ipfs) {
  if (states[state] !== undefined) {
    states[state]()
  } else {
    throw new Error('Could not find state "' + state + '"')
  }
}

/* ===========================================================================
   Boot the app
   =========================================================================== */

const startApplication = () => {
  // Setup event listeners
  $dragContainer.addEventListener('dragenter', onDragEnter)
  $dragContainer.addEventListener('dragover', onDragEnter)
  $dragContainer.addEventListener('drop', async e => {
    try {
      await onDrop(e)
    } catch (err) {
      err.message = `Failed to add files: ${err.message}`
      onError(err)
    }
  })
  $dragContainer.addEventListener('dragleave', onDragLeave)
  $fetchButton.addEventListener('click', async () => {
    try {
      await getFile()
    } catch (err) {
      err.message = `Failed to fetch CID: ${err.message}`
      onError(err)
    }
  })
  $connectButton.addEventListener('click', async () => {
    try {
      await connectToPeer()
    } catch (err) {
      err.message = `Failed to connect to peer: ${err.message}`
      onError(err)
    }
  })
  $workspaceBtn.addEventListener('click', () => {
    window.location.hash = $workspaceInput.value
  })

  start()
}

startApplication()
