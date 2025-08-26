module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
      },
    }],
    ['@babel/preset-react', {
      runtime: 'automatic',
    }],
  ],
  plugins: [],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current',
          },
        }],
        ['@babel/preset-react', {
          runtime: 'automatic',
        }],
      ],
    },
  },
};