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
    return loadPage(
      driver,
      FacebookLoginPage.uri,
      FacebookLoginPage.untilLoaded
    )
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

  static get untilLoaded() {
    return untilAllElementsLoaded( 
      // TODO Ditch this and just use untilDocumentLoaded
      By.id(FacebookLoginPage.emailFormId),
      By.id(FacebookLoginPage.passwordFormId),
      By.id(FacebookLoginPage.loginButtonId)
    );
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
      () => this.driver.wait(FacebookHomePage.untilLoaded)
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

  static get untilLoaded() {
    return untilDocumentLoaded;
  } 
}

class FacebookMessengerPage extends Page {
  static loadMessagesWith(driver, userId) {
    return loadPage(
      driver,
      FacebookMessengerPage.uriForUser(userId),
      FacebookMessengerPage.untilMessagesLoaded
    )
    .then(
      NotificationsDialogue.denyIfNeeded(driver)
    )
    .then(
      () => new FacebookMessengerPage(driver).focusInputForm()
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

  static get untilMessagesLoaded() {
    return untilElementLoaded(
      By.className(FacebookMessengerPage.messageBoxClassName)
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
    return this.getInputForm()
    .then(
      inputForm => inputForm.sendKeys(Key.PAGE_UP)
    );
  }

  getMessages() {
    return this.findMessageWebElements()
    .then(
      elements => elements.map(element => new Message(element))
    );
  }

  findMessageWebElements() {
    return this.driver.findElements(
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

  getInputForm() {
    return this.driver.findElement(
      By.className(FacebookMessengerPage.inputFormClassName)
    );
  }
}

class Message {
  static get senderSpanClassName() {
    return '_ih3';
  }

  static get contentSpanClassName() {
    return '_3oh- _58nk';
  }

  static get timestampDivSelector() {
    return 'div[data-hover="tooltip"';
  }

  constructor(webElement) {
    this.webElement = webElement;
  }
  
  decodeSender() {
    return this.getSenderSpan()
    .then(
      senderSpan => getHtmlSource(senderSpan)
    );
  }

  getSenderSpan() {
    return this.webElement.findElement(By.className(
      Message.senderSpanClassName
    ));
  }

  decodeContent() {
    return this.getContentSpans()
    .then(
      contentSpans => getAllHtmlSources(contentSpans)
    )
    .then(
      htmlSources => formatAsLines(htmlSources)
    );
  }

  getContentSpans() {
    return this.webElement.findElements(By.className(
      Message.contentSpanClassName
    ));
  }

  decodeTimestamp() {
    return this.getTimestampDiv()
    .then(
      timestampDiv => getTooltipContent(timestampDiv)
    );
  }

  getTimestampDiv() {
    return this.webElement.findElement(By.css(
      Message.timestampDivSelector
    ));
  }

  decodeHtml() {
    return promise.all([
      this.decodeSender(),
      this.decodeTimestamp(),
      this.decodeContent()
    ]);
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

// TODO These "driver" arguments are misleading, perhaps "elementContainer"

const untilEither = (promise1, promise2) =>
  driver => 
    promise1(driver)
    .then(
      over => over ? true : promise2(driver)
    );

const untilDocumentLoaded = driver => {
  const documentIsComplete = () =>
    document.readyState === 'complete';
  return driver.executeScript(documentIsComplete);
}

const getTooltipContent = element =>
  element.getAttribute('data-tooltip-content')

const formatAsLines = strings => strings.join('<br>');

const getAllHtmlSources = elements =>
  promiseEach(elements, getHtmlSource);

const getHtmlSource = element => element.getAttribute('innerHTML');

const loadPage = (driver, uri, condition) => {
  driver.get(uri);
  return driver.wait(condition);
};

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

const checkElementLoaded = (driver, findBy) =>
  driver.findElements(findBy).then(
    elements => !!elements.length
  );

const allPredicates = (...predicates) => 
  (...args) => predicates.every(pred => pred(...args));

const promisedFs = {}; // TODO Turn into a static class

promisedFs.open = (path, flags, mode = undefined) =>
  new Promise(
    (resolve, reject) => 
      fs.open(
        path, flags, mode,
        promisedFs._promiseCallback(resolve, reject)
      )
  );

promisedFs.appendFile = (file, data, options = undefined) => 
  new Promise(
    (resolve, reject) => fs.appendFile(
      file, data, options,
      promisedFs._promiseCallback(resolve, reject)
    )
  );

promisedFs._promiseCallback = (resolve, reject) => 
  (err, result) => err ? reject(err) : resolve(result);

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
      promisedFs.appendFile(fd, formatDecodedMessage(decodedMessage))
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
  promisedFs.open(fileName, 'a')
  .then(
    fd => prepareHtmlFile(fd)
  );

const prepareHtmlFile = fd =>
  promisedFs.appendFile(
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

