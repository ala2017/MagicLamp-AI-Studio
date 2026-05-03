const path = require('path');
const webpack = require('webpack');

const commonRules = [
  {
    test: /\.(ts|tsx)$/,
    exclude: /node_modules/,
    use: [
      {
        loader: 'ts-loader',
        options: {
          transpileOnly: true
        }
      }
    ]
  },
  {
    test: /\.css$/,
    use: ['style-loader', 'css-loader']
  },
  {
    test: /\.(svg|png|jpg)$/,
    type: 'asset/inline'
  }
];

const commonResolve = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  alias: {
    '@shared': path.resolve(__dirname, 'src/shared'),
    '@core': path.resolve(__dirname, 'src/core'),
    '@webview': path.resolve(__dirname, 'src/webview')
  }
};

/** @type {import('webpack').Configuration[]} */
const configs = [
  // Config 1: Extension Host (Node.js)
  {
    name: 'extension',
    mode: 'none',
    target: 'node', // Crucial for 'https', 'fs', 'child_process'
    entry: {
      extension: './src/extension.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs',
      devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    resolve: commonResolve,
    module: {
      rules: commonRules
    },
    externals: {
      'vscode': 'commonjs vscode'
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: { level: "log" }
  },

  // Config 2: Webview (Browser)
  {
    name: 'webview',
    mode: 'none',
    target: 'web', // Crucial for React and DOM
    entry: {
      webview: './src/webview/index.tsx'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webview.js',
      devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    resolve: commonResolve,
    module: {
      rules: commonRules
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env': JSON.stringify({}),
        'process.env.NODE_ENV': JSON.stringify('production')
      })
    ],
    devtool: 'nosources-source-map',
    infrastructureLogging: { level: "log" }
  }
];

module.exports = configs;
