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
    driver.get(FacebookMessengerPage.uriForUser(targetId))
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

  constructor(driver, targetId) {
    super(driver);
    this.screenshotCount = 0;
    this.targetId = targetId;
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

  captureAllMessages() {

  }

  checkAllMessagesPreloaded() {
    return checkElementLoaded(
      this.driver,
      By.className(FacebookMessengerPage.topTextClassName)
    );
  }

  checkExtraMessagesLoading() {
    return checkElementLoaded(
      this.driver,
      By.className(FacebookMessengerPage.extraMessagesBufferClassName)
    );
  }

  checkExtraMessagesLoaded() {
    return this.checkExtraMessagesLoading()
    .then(
      loading => !loading
    );
  }

  saveScreenshot() {
    this.driver.takeScreenshot()
    .then(
      screenshot => saveScreenshot(`${this.targetId}/${this.screenshotCount}`, screenshot)
    )
    .then(
      () => ++this.screenshotCount
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

const getTooltipContent = element =>
  element.getAttribute('data-tooltip-content')

const formatAsHtmlLines = strings => strings.join('<br>');

const getAllHtmlSources = elements =>
  promiseEach(elements, getHtmlSource);

const getHtmlSource = element => element.getAttribute('innerHTML');

const stringContains = (text, substring) =>
  text.indexOf(substring) !== -1;

const userId = userUri => 
  stringContains(userUri, 'profile.php') ?
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

const untilAllElementsLoaded = (...findBys) => {
  const predicates = findBys.map(
    findBy => untilElementLoaded(findBy)
  );
  return allPredicates(...predicates);
}

const untilElementLoaded = findBy => 
  driver => checkElementLoaded(driver, findBy);

const checkElementLoaded = (elementContainer, findBy) =>
  elementContainer.findElements(findBy).then(
    elements => !!elements.length
  );

const allPredicates = (...predicates) => 
  (...args) => predicates.every(pred => pred(...args));

const fetchMessagesWithUser = (driver, targetId) =>
  FacebookMessengerPage.loadMessagesWith(driver, targetId)
  .then(
    messengerPage => messengerPage.preloadAllMessages()
  )
  .then(
    messengerPage => messengerPage.getMessages()
  );

const promiseEach = (elements, asyncFunc) =>
  promise.all(elements.map(asyncFunc));

const decodeMessages = messages =>
  promiseEach(messages, message => message.decodeHtml());

const writeMessagesToFile = (messages, fd) =>
  decodeMessages(messages)
  .then(
    decodedMessages => writeDecodedMessagesToFile(decodedMessages, fd)
  );

const writeDecodedMessagesToFile = (decodedMessages, fd) => 
  promiseEach(
    decodedMessages,
    decodedMessage => 
      PromisedFs.appendFile(fd, formatDecodedMessage(decodedMessage))
  );

const formatDecodedMessage = ([sender, timestamp, content]) =>
  `${sender} (${timestamp}): ${content}<br><br>`;

const processTarget = (driver, targetUri) => {
  const targetId = userId(targetUri);

  return fetchMessagesWithUser(driver, targetId)
  .then(
    messages => promise.all([
        openHtmlFileForAppending(`${targetId}.html`),
        promise.fulfilled(messages)
      ])
  )
  .then(
    ([fd, messages]) => writeMessagesToFile(messages, fd)
  );
}

const openHtmlFileForAppending = fileName =>
  PromisedFs.open(fileName, 'a')
  .then(
    fd => prepareHtmlFile(fd)
  );

const prepareHtmlFile = fd =>
  PromisedFs.appendFile(
    fd, 
    `<meta charset="utf8">${thisMoment()}<br><br><br>`
  )
  .then(
    () => fd
  );

const thisMoment = () =>
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

