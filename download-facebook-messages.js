'use strict';

const webdriver = require('selenium-webdriver');
const fs = require('fs');
const By = webdriver.By;
const Key = webdriver.Key;
const until = webdriver.until;
const promise = webdriver.promise;

const browser = 'firefox';

class Page {
  constructor(driver) {
    this.driver = driver;
  }
}

class FacebookLoginPage extends Page {
  static load(driver) {
    return driver.get(FacebookLoginPage.uri)
    .then(() => new FacebookLoginPage(driver));
  }  

  static get uri() {
    return `${FacebookHomePage.uri}login.php/`;
  }

  static get emailFormId() {
    return 'email';
  }

  static get passwordFormId() {
    return 'pass';
  }

  static get loginButtonId() {
    return 'loginbutton';
  }

  fillOut({email, password}) {
    return promise.all([
      this.fillEmailForm(email),
      this.fillPasswordForm(password)
    ]).then(() => this);
  }

  fillEmailForm(email) {
    return writeToForm(
      this.driver, 
      By.id(FacebookLoginPage.emailFormId),
      email
    );
  }

  fillPasswordForm(password) {
    return writeToForm(
      this.driver,
      By.id(FacebookLoginPage.passwordFormId),
      password
    );
  }

  clickLoginButton() {
    return clickButton(
      this.driver,
      By.id(FacebookLoginPage.loginButtonId)
    )
    .then(
      () => this.driver.wait(untilDocumentLoaded)
    )
    .then(
      () => new FacebookHomePage(this.driver)
    );
  }
}

class FacebookHomePage extends Page {
  static get uri() {
    return 'https://www.facebook.com/';
  }

  static get notNowButtonClassName() {
    return 'layerCancel _4jy0 _4jy3 _517h _51sy _42ft';
  }
}

class FacebookMessengerPage extends Page {
  static loadMessagesWith(driver, targetId) {
    return driver.get(FacebookMessengerPage.uriForUser(targetId))
    .then(
      NotificationsDialogue.denyIfNeeded(driver)
    )
    .then(
      () => new FacebookMessengerPage(driver, targetId).focusInputForm()
    )
  }

  static uriForUser(userId) {
    return `${FacebookHomePage.uri}messages/t/${userId}/`;
  }

  static get messageBoxClassName() {
    return '_41ud';
  }

  static get topTextClassName() {
    return '_1n-e';
  }

  static get inputFormClassName() {
    return '_1mf _1mj';
  }

  static get extraMessagesBufferClassName() {
    return '_3u55 _3qh2 img sp_dWkVmyYN8i1 sx_2563d0';
  }

  static get untilMessagesLoaded() {
    return untilElementLoaded(
      By.className(FacebookMessengerPage.messageBoxClassName)
    );
  }

  preloadAllMessages() {
    return this.checkAllMessagesPreloaded()
    .then(
      allMessagesPreloaded =>
        allMessagesPreloaded ? this
                             : this.scrollUp()
                               .then(
                                 () => this.preloadAllMessages()
                               )
    );
  }

  checkAllMessagesPreloaded() {
    return checkElementLoaded(
      this.driver,
      By.className(FacebookMessengerPage.topTextClassName)
    );
  }

  focusInputForm() {
    return this.getInputForm()
    .then(
      inputForm => inputForm.click()
    )
    .then(
      () => this
    );
  }

  scrollUp(inputForm) {
    return this.sendKey(Key.PAGE_UP);
  }

  scrollDown(inputForm) {
    return this.sendKey(Key.PAGE_DOWN);
  }

  sendKey(key) {
    return this.getInputForm()
    .then(
      inputForm => inputForm.sendKeys(key)
    );
  }

  getInputForm() {
    return this.driver.findElement(
      By.className(FacebookMessengerPage.inputFormClassName)
    );
  }

  takeScreenshot() {
    return this.driver.takeScreenshot();
  }
}

class MessageScreenshots {
  constructor() {
    this.array = [];
  }

  record(messengerPage) {
    return messengerPage.preloadAllMessages() // TODO This is too long
    .then(
      () => this.takeScreenshotOf(messengerPage)
    )
    .then(
      () => promise.all([
        messengerPage.scrollDown(),
        this.takeScreenshotOf(messengerPage)
      ])
    )
    .then(
      () => this.checkAllMessagesRecorded()
    )
    .then(
      allMessagesRecorded => 
        allMessagesRecorded ? this : this.record(messengerPage)
    );
  }

  takeScreenshotOf(messengerPage) {
    return messengerPage.takeScreenshot()
    .then(
      screenshot => this.array.push(screenshot)
    );
  }

  checkAllMessagesRecorded() {
    if (this.array.length < 3)
      return false;
    return this.array[this.array.length-1] == this.array[this.array.length-2] &&
           this.array[this.array.length-2] == this.array[this.array.length-3];
  }

  saveToDirectory(directory) {
    return mkdir(directory)
    .then(
      () => forEachAsync(
        this.array,
        (screenshot, index) => saveScreenshot(`${directory}/${index}`, screenshot)
      )
    );
  }
}

class NotificationsDialogue {
  static denyIfNeeded(driver) {
    return NotificationsDialogue.checkPoppedUp(driver)
    .then(
      poppedUp => {
        if (poppedUp)
          NotificationsDialogue.deny(driver);
      }
    );
  }

  static checkPoppedUp(driver) {
    return checkElementLoaded(
      driver,
      By.className(FacebookHomePage.notNowButtonClassName)
    );
  }

  static deny(driver) {
    return clickButton(driver, By.className(
      FacebookHomePage.notNowButtonClassName
    ));
  }
}

const forEachAsync = (arr, asyncFunc) =>
  promise.all(arr.map(asyncFunc));

const saveScreenshot = (path, png) =>
  new Promise(
    (resolve, reject) => fs.writeFile(
      path, 
      png, 
      'base64', 
      fsCallback(resolve, reject)
    )
  );

const mkdir = path =>
  new Promise(
    (resolve, reject) => fs.mkdir(path, fsCallback(resolve, reject))
  );

const fsCallback = (resolve, reject) =>
  err => {
    if (err) reject(err);
    else resolve();
  };

const untilDocumentLoaded = driver => {
  const documentIsComplete = () =>
    document.readyState === 'complete';
  return driver.executeScript(documentIsComplete);
}

const userId = userUri => 
  userUri.includes('profile.php') ?
    userUri.slice((`${FacebookHomePage.uri}profile.php?id=`).length) :
    userUri.slice(FacebookHomePage.uri.length);

const writeToForm = (driver, findBy, text) =>
  driver.findElement(findBy).then(
    element => element.sendKeys(text)
  );

const clickButton = (driver, findBy) => 
  driver.findElement(findBy).then(
    element => element.click()
  );

const checkElementLoaded = (elementContainer, findBy) =>
  elementContainer.findElements(findBy).then(
    elements => !!elements.length
  );

const captureMessagesWithUser = (driver, targetId) =>
  FacebookMessengerPage.loadMessagesWith(driver, targetId)
  .then(
    messengerPage => messengerPage.preloadAllMessages()
  )
  .then(
    messengerPage => new MessageScreenshots().record(messengerPage)
  )
  .then(
    screenshots => screenshots.saveToDirectory(targetId)
  );

const processTarget = (driver, targetUri) => {
  const targetId = userId(targetUri);
  return captureMessagesWithUser(driver, targetId);
}

const thisMoment = () => // TODO Make use of this  ???
  new Date().toString();

const processTargets = (driver, [targetUri, ...remainingTargetUris]) => {
  if (targetUri)
    return processTarget(driver, targetUri)
    .then(
      () => processTargets(driver, remainingTargetUris)
    );
  return promise.fulfilled();
}

if (process.argv.length < 3 || process.argv[2] === '--help') {
  const usage = 
    'Usage: node download-facebook-messages.js ' +
    '<email> <password> <targetUrls>';
  console.log(usage);
  return 0;
}

const credentials = {
  email: process.argv[2],
  password: process.argv[3]
};

const targetUris = process.argv.slice(4);

const driver = new webdriver.Builder().forBrowser(browser).build();

FacebookLoginPage.load(driver)
.then(
  loginPage => loginPage.fillOut(credentials)
)
.then(
  loginPage => loginPage.clickLoginButton()
)
.then(
  () => processTargets(driver, targetUris)
)
