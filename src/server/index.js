const {Server} = require('hapi')
const Vision = require('vision')
const Inert = require('inert')
const Nunjucks = require('nunjucks')

const Webpack = require('webpack')
const Dashboard = require('webpack-dashboard/plugin')

const Socket = require('socket.io')

const wpConfig = require('../../webpack.config')
const Config = require('../config/variables')

const Routes = require('./routes')
const Home = require('./modules/home')

const server = new Server()
server.connection(Config.server)

const io = Socket(server.listener)
const Serialport = require('serialport')

const compiler = Webpack(wpConfig)
compiler.apply(new Dashboard())

const host = Config.server.host
const port = Config.server.port

const devMiddleware = require('webpack-dev-middleware')(compiler, {
  host, port,
  historyApiFallback: true,
  publicPath: wpConfig.output.publicPath,
  quiet: true
})

const serialport = new Serialport(Config.defaultPort, Config.serialport(Serialport))

io.on('connection', socket => {
  console.log(`Socket is open on ${server.info.port}`)
  socket.setMaxListeners(0)
  socket.on('req-connect', _ => {
    if (!serialport.isOpen()) {
      serialport.open(err => {
        if (err) {
          socket.emit('confirm-connect', { err: true, message: 'Cannot open serialport' })
        } else {
          socket.emit('confirm-connect', { err: false, status: true })
        }
      })
    } else {
      socket.emit('confirm-connect', { err: false, status: true, message: 'Serial connection have already opened!'})
    }
  })
})

server.ext('onRequest', (request, reply) => {
  devMiddleware(request.raw.req, request.raw.res, err => {
    if (err) {
      return reply(err)
    }

    return reply.continue()
  })
})

server.register([Config.good, Vision, Inert], err => {
  if (err) {
    throw err
  }

  // Register routes
  Routes([Home], server)

  // Nunjucks - view manager
  server.views( Config.engines(Nunjucks, __dirname))
})

server.start(err => {
  if (err) {
    throw err
  }

  console.log(`Server is running on ${server.info.uri}`)
})