const PRODUCT_DISPLAY_NAME = 'Monstruo Studio'
const PRODUCT_BUNDLE_ID = 'mx.hivecom.monstruostudio'

function configureProductIdentity(app, pathModule) {
  if (!app || typeof app.setName !== 'function' || typeof app.getPath !== 'function' || typeof app.setPath !== 'function') {
    throw new TypeError('A valid Electron app instance is required')
  }
  if (!pathModule || typeof pathModule.join !== 'function') {
    throw new TypeError('A path module with join() is required')
  }

  app.setName(PRODUCT_DISPLAY_NAME)
  const appDataPath = app.getPath('appData')
  const userDataPath = pathModule.join(appDataPath, PRODUCT_DISPLAY_NAME)
  app.setPath('userData', userDataPath)
  return userDataPath
}

module.exports = {
  PRODUCT_BUNDLE_ID,
  PRODUCT_DISPLAY_NAME,
  configureProductIdentity,
}
