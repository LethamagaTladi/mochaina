// Global state
let currentPage = "register"
let darkMode = false
let currentUser = null
let stripe = null // Declare the Stripe variable
let isStripeLoading = true
let paymentProcessing = false

// Form states
const registerForm = {
  firstName: "",
  surname: "",
  idNumber: "",
  email: "",
  contactNumber: "",
  password: "",
  confirmPassword: "",
  proofOfResidence: null,
  certifiedIdCopy: null,
}

const loginForm = {
  emailOrPhone: "",
  password: "",
}

// Wallet states
let balance = 0
let savedCards = []
let selectedCardId = ""
let paymentMethod = "card"
const bankDetails = {
  accountNumber: "",
  bankName: "",
  accountHolder: "",
}

// Game states
let selectedNumbers = []
let selectedBonus = null
const betAmount = "3.00"
let bettingSlips = []
let gameResults = []
let nextDrawTime = null
let currentDraw = null
let drawHistory = []

// South African banks
const southAfricanBanks = [
  "ABSA Bank",
  "Standard Bank",
  "First National Bank (FNB)",
  "Nedbank",
  "Capitec Bank",
  "African Bank",
  "Investec Bank",
  "Discovery Bank",
  "Bidvest Bank",
  "Sasfin Bank",
  "Mercantile Bank",
  "Grindrod Bank",
  "Ithala Development Finance Corporation",
  "Bank Zero",
  "TymeBank",
]

// Utility functions
function calculateAge(idNumber) {
  if (idNumber.length < 6) return 0
  const year = Number.parseInt(idNumber.substring(0, 2))
  const month = Number.parseInt(idNumber.substring(2, 4))
  const day = Number.parseInt(idNumber.substring(4, 6))

  const fullYear = year > 50 ? 1900 + year : 2000 + year
  const birthDate = new Date(fullYear, month - 1, day)
  const today = new Date()

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age
}

function getGenderFromId(idNumber) {
  if (idNumber.length < 7) return "unknown"
  const genderDigit = Number.parseInt(idNumber.substring(6, 7))
  return genderDigit >= 5 ? "male" : "female"
}

function updateTheme() {
  const app = document.getElementById("app")
  const header = document.getElementById("header")

  // Update dark mode
  if (darkMode) {
    app.classList.add("dark")
    document.getElementById("sun-icon").classList.remove("hidden")
    document.getElementById("moon-icon").classList.add("hidden")
  } else {
    app.classList.remove("dark")
    document.getElementById("sun-icon").classList.add("hidden")
    document.getElementById("moon-icon").classList.remove("hidden")
  }

  // Update gender theme
  if (currentUser) {
    const gender = getGenderFromId(currentUser.idNumber)
    if (gender === "female") {
      app.classList.add("female")
    } else {
      app.classList.remove("female")
    }
  }

  // Update header color
  if (currentUser) {
    const gender = getGenderFromId(currentUser.idNumber)
    if (gender === "female") {
      header.className = darkMode ? "bg-pink-600 text-white p-4 shadow-lg" : "bg-pink-500 text-white p-4 shadow-lg"
    } else {
      header.className = darkMode ? "bg-blue-600 text-white p-4 shadow-lg" : "bg-blue-500 text-white p-4 shadow-lg"
    }
  } else {
    header.className = darkMode ? "bg-blue-600 text-white p-4 shadow-lg" : "bg-blue-500 text-white p-4 shadow-lg"
  }
}

function showPage(page) {
  // Hide all pages
  document.getElementById("register-page").classList.add("hidden")
  document.getElementById("login-page").classList.add("hidden")
  document.getElementById("main-app").classList.add("hidden")
  document.getElementById("wallet-page").classList.remove("hidden")
  document.getElementById("game-page").classList.add("hidden")

  // Show selected page
  if (page === "register") {
    document.getElementById("register-page").classList.remove("hidden")
  } else if (page === "login") {
    document.getElementById("login-page").classList.remove("hidden")
  } else if (page === "wallet" || page === "game") {
    document.getElementById("main-app").classList.remove("hidden")
    if (page === "game") {
      document.getElementById("wallet-page").classList.add("hidden")
      document.getElementById("game-page").classList.remove("hidden")
      document.getElementById("game-nav").classList.add("btn-primary")
      document.getElementById("game-nav").classList.remove("btn-outline")
      document.getElementById("wallet-nav").classList.add("btn-outline")
      document.getElementById("wallet-nav").classList.remove("btn-primary")
    } else {
      document.getElementById("wallet-nav").classList.add("btn-primary")
      document.getElementById("wallet-nav").classList.remove("btn-outline")
      document.getElementById("game-nav").classList.add("btn-outline")
      document.getElementById("game-nav").classList.remove("btn-primary")
    }
  }

  currentPage = page
}

function showError(elementId, message) {
  const element = document.getElementById(elementId)
  if (element) {
    element.textContent = message
    element.classList.remove("hidden")
  }
}

function hideError(elementId) {
  const element = document.getElementById(elementId)
  if (element) {
    element.classList.add("hidden")
  }
}

function updateBalance() {
  document.getElementById("balance-display").textContent = `R${balance.toFixed(2)}`
}

function getNextHourTimestamp() {
  const now = new Date()
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0)
  return nextHour
}

function generateAutomaticDraw() {
  const drawnNumbers = []
  while (drawnNumbers.length < 3) {
    const num = Math.floor(Math.random() * 50) + 1
    if (!drawnNumbers.includes(num)) {
      drawnNumbers.push(num)
    }
  }
  const drawnBonus = Math.floor(Math.random() * 9) + 1

  const draw = {
    id: Date.now(),
    numbers: drawnNumbers,
    bonus: drawnBonus,
    timestamp: new Date().toISOString(),
    drawTime: new Date().toLocaleString(),
  }

  currentDraw = draw
  drawHistory = [draw, ...drawHistory.slice(0, 9)]

  // Process all active betting slips automatically
  if (bettingSlips.length > 0) {
    processSlipsForDraw(draw)
  }

  // Set next draw time
  nextDrawTime = getNextHourTimestamp()

  // Store in localStorage
  if (currentUser) {
    localStorage.setItem("mochainaCurrentDraw_" + currentUser.id, JSON.stringify(draw))
    localStorage.setItem("mochainaDrawHistory_" + currentUser.id, JSON.stringify(drawHistory))
  }

  updateDrawDisplay()
}

function processSlipsForDraw(draw) {
  if (bettingSlips.length === 0) return

  const totalCost = bettingSlips.reduce((sum, slip) => sum + slip.amount, 0)

  if (totalCost > balance) {
    showError("game-error", "Insufficient funds for betting slips - some slips were not processed")
    return
  }

  // Deduct total cost from balance
  balance -= totalCost
  localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
  updateBalance()

  // Process each betting slip against the draw
  const results = bettingSlips.map((slip) => {
    const matchingNumbers = slip.numbers.filter((num) => draw.numbers.includes(num)).length
    const bonusMatch = slip.bonus === draw.bonus

    let totalWinnings = 0
    let winType = "no_win"

    if (matchingNumbers === 3 && bonusMatch) {
      totalWinnings = slip.amount * (47 / 3) // 15.67x ratio
      winType = "main_plus_bonus"
    } else if (matchingNumbers === 3) {
      totalWinnings = slip.amount * (40 / 3) // 13.33x ratio
      winType = "main_numbers"
    }

    return {
      slipId: slip.id,
      slip: slip,
      drawnNumbers: draw.numbers,
      drawnBonus: draw.bonus,
      matchingNumbers,
      bonusMatch,
      winType,
      totalWinnings,
      timestamp: draw.timestamp,
      drawId: draw.id,
    }
  })

  // Add winnings to balance immediately
  const totalWinnings = results.reduce((sum, result) => sum + result.totalWinnings, 0)
  if (totalWinnings > 0) {
    balance += totalWinnings
    localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
    updateBalance()
  }

  // Store results and clear betting slips
  gameResults = results
  bettingSlips = []
  localStorage.setItem("mochainaBettingSlips_" + currentUser.id, JSON.stringify([]))
  localStorage.setItem("mochainaGameResults_" + currentUser.id, JSON.stringify(results))

  hideError("game-error")
  updateGameDisplay()
  updateResultsDisplay()
}

function updateDrawDisplay() {
  if (currentDraw) {
    document.getElementById("current-draw").classList.remove("hidden")
    document.getElementById("draw-time").textContent = `Latest draw from ${currentDraw.drawTime}`

    const winningNumbers = document.getElementById("winning-numbers")
    winningNumbers.innerHTML = ""
    currentDraw.numbers.forEach((num) => {
      const ball = document.createElement("div")
      ball.className = "number-ball"
      ball.textContent = num
      winningNumbers.appendChild(ball)
    })

    document.getElementById("bonus-number").textContent = currentDraw.bonus

    if (nextDrawTime) {
      document.getElementById("next-draw-time").textContent = `Next draw: ${nextDrawTime.toLocaleString()}`
    }
  }

  if (drawHistory.length > 0) {
    document.getElementById("draw-history").classList.remove("hidden")
    const historyList = document.getElementById("history-list")
    historyList.innerHTML = ""

    drawHistory.slice(0, 5).forEach((draw) => {
      const item = document.createElement("div")
      item.className = "flex justify-between items-center p-3 border rounded-lg"
      item.innerHTML = `
                <div class="flex items-center space-x-4">
                    <span class="text-sm text-gray-600">${draw.drawTime}</span>
                    <div class="flex space-x-1">
                        ${draw.numbers.map((num) => `<div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">${num}</div>`).join("")}
                        <div class="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">${draw.bonus}</div>
                    </div>
                </div>
            `
      historyList.appendChild(item)
    })
  }
}

// Initialize Stripe
function initializeStripe() {
  if (typeof window.Stripe !== "undefined") {
    // Use window.Stripe to ensure it's defined
    try {
      stripe = window.Stripe("pk_test_51234567890") // Replace with actual publishable key
      isStripeLoading = false
      document.getElementById("stripe-loading").classList.add("hidden")
    } catch (error) {
      console.error("Stripe initialization failed:", error)
      isStripeLoading = false
      document.getElementById("stripe-loading").classList.add("hidden")
    }
  }
}

// Registration functions
function handleRegisterSubmit(e) {
  e.preventDefault()

  // Clear previous errors
  document.querySelectorAll(".error-text").forEach((el) => el.classList.add("hidden"))

  const formData = new FormData(e.target)
  const errors = {}

  // Get form values
  registerForm.firstName = formData.get("firstName") || ""
  registerForm.surname = formData.get("surname") || ""
  registerForm.idNumber = formData.get("idNumber") || ""
  registerForm.email = formData.get("email") || ""
  registerForm.contactNumber = formData.get("contactNumber") || ""
  registerForm.password = formData.get("password") || ""
  registerForm.confirmPassword = formData.get("confirmPassword") || ""

  // Validation
  if (!registerForm.firstName.trim()) errors.firstName = "First name is required"
  if (!registerForm.surname.trim()) errors.surname = "Surname is required"
  if (!registerForm.idNumber.trim()) errors.idNumber = "ID number is required"
  if (!registerForm.email.trim()) errors.email = "Email is required"
  if (!registerForm.contactNumber.trim()) errors.contactNumber = "Contact number is required"
  if (!registerForm.password) errors.password = "Password is required"
  if (registerForm.password !== registerForm.confirmPassword) {
    errors.confirmPassword = "Passwords do not match"
  }

  // Check age
  const age = calculateAge(registerForm.idNumber)
  if (age < 18) {
    errors.idNumber = "You must be 18 or older to register"
  }

  // Check if ID already exists
  const existingAccounts = JSON.parse(localStorage.getItem("mochainaAccounts") || "[]")
  if (existingAccounts.find((acc) => acc.idNumber === registerForm.idNumber)) {
    errors.idNumber = "An account with this ID number already exists"
  }

  // Show errors
  Object.keys(errors).forEach((field) => {
    showError(field + "-error", errors[field])
    document.getElementById(field).classList.add("border-red-500")
  })

  if (Object.keys(errors).length > 0) {
    return
  }

  // Save account
  const newAccount = {
    ...registerForm,
    id: Date.now(),
    balance: 0,
    createdAt: new Date().toISOString(),
  }

  existingAccounts.push(newAccount)
  localStorage.setItem("mochainaAccounts", JSON.stringify(existingAccounts))
  localStorage.setItem("mochainaBalance_" + newAccount.id, "0")

  alert("Registration successful! Please login.")
  showPage("login")

  // Reset form
  document.getElementById("register-form").reset()
}

// Login functions
function handleLoginSubmit(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  loginForm.emailOrPhone = formData.get("emailOrPhone") || ""
  loginForm.password = formData.get("password") || ""

  const accounts = JSON.parse(localStorage.getItem("mochainaAccounts") || "[]")

  const user = accounts.find(
    (acc) =>
      (acc.email === loginForm.emailOrPhone || acc.contactNumber === loginForm.emailOrPhone) &&
      acc.password === loginForm.password,
  )

  if (user) {
    currentUser = user
    balance = Number.parseFloat(localStorage.getItem("mochainaBalance_" + user.id) || "0")

    // Load user data
    loadUserData()

    document.getElementById("welcome-text").textContent = `Welcome, ${user.firstName}!`
    document.getElementById("welcome-text").classList.remove("hidden")
    document.getElementById("logout-btn").classList.remove("hidden")

    updateBalance()
    updateTheme()
    showPage("wallet")
    hideError("login-error")

    // Initialize hourly draw system
    initializeDrawSystem()
  } else {
    showError("login-error", "Invalid credentials")
  }
}

function loadUserData() {
  if (!currentUser) return

  // Load saved cards
  const savedCardsData = localStorage.getItem("mochainaCards_" + currentUser.id)
  if (savedCardsData) {
    savedCards = JSON.parse(savedCardsData)
    updateCardsDisplay()
  }

  // Load betting slips
  const savedBettingSlips = localStorage.getItem("mochainaBettingSlips_" + currentUser.id)
  if (savedBettingSlips) {
    bettingSlips = JSON.parse(savedBettingSlips)
  } else {
    bettingSlips = []
  }

  // Load game results
  const savedGameResults = localStorage.getItem("mochainaGameResults_" + currentUser.id)
  if (savedGameResults) {
    gameResults = JSON.parse(savedGameResults)
  } else {
    gameResults = []
  }

  // Load current draw and history
  const savedCurrentDraw = localStorage.getItem("mochainaCurrentDraw_" + currentUser.id)
  if (savedCurrentDraw) {
    currentDraw = JSON.parse(savedCurrentDraw)
  }

  const savedDrawHistory = localStorage.getItem("mochainaDrawHistory_" + currentUser.id)
  if (savedDrawHistory) {
    drawHistory = JSON.parse(savedDrawHistory)
  }

    // Initialize next draw time
    const nextDrawKey = "mochainaNextDrawTime_" + currentUser.id;
    let storedNextDraw = localStorage.getItem(nextDrawKey);
    if (storedNextDraw) {
      nextDrawTime = new Date(storedNextDraw);
    } else {
      nextDrawTime = getNextHourTimestamp();
      localStorage.setItem(nextDrawKey, nextDrawTime.toISOString());
    }

  updateGameDisplay()
  updateResultsDisplay()
  updateDrawDisplay()
}

function initializeDrawSystem() {
  // Set up hourly interval for automatic draws
    if (!currentUser) return;
    const nextDrawKey = "mochainaNextDrawTime_" + currentUser.id;
    // Try to load nextDrawTime from localStorage
    let storedNextDraw = localStorage.getItem(nextDrawKey);
    if (storedNextDraw) {
      nextDrawTime = new Date(storedNextDraw);
    } else {
      nextDrawTime = getNextHourTimestamp();
      localStorage.setItem(nextDrawKey, nextDrawTime.toISOString());
    }

    const checkDrawTime = () => {
      const now = new Date();
      if (now >= nextDrawTime) {
        generateAutomaticDraw();
        // Set next draw time for the next hour
        nextDrawTime = getNextHourTimestamp();
        localStorage.setItem(nextDrawKey, nextDrawTime.toISOString());
      }
    };

    setInterval(checkDrawTime, 60000); // Check every minute
    // Also run once on load in case the hour already passed
    checkDrawTime();
}

function logout() {
  currentUser = null
  balance = 0
  savedCards = []
  selectedCardId = ""
  bettingSlips = []
  gameResults = []
  currentDraw = null
  drawHistory = []

  document.getElementById("welcome-text").classList.add("hidden")
  document.getElementById("logout-btn").classList.add("hidden")

  updateTheme()
  showPage("login")
}

// Wallet functions
function updateCardsDisplay() {
  const cardsList = document.getElementById("cards-list")
  const savedCardsDiv = document.getElementById("saved-cards")

  if (savedCards.length > 0) {
    savedCardsDiv.classList.remove("hidden")
    cardsList.innerHTML = ""

    savedCards.forEach((card) => {
      const cardDiv = document.createElement("div")
      cardDiv.className = `card-item ${selectedCardId === card.id ? "selected" : ""}`
      cardDiv.onclick = () => {
        selectedCardId = card.id
        updateCardsDisplay()
      }

      cardDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                            <line x1="1" y1="10" x2="23" y2="10"></line>
                        </svg>
                        <span class="font-medium">${card.brand.toUpperCase()} •••• ${card.last4}</span>
                    </div>
                    <span class="text-sm text-gray-500">${card.expMonth}/${card.expYear}</span>
                </div>
                <p class="text-sm text-gray-600 mt-1">${card.name}</p>
            `

      cardsList.appendChild(cardDiv)
    })
  } else {
    savedCardsDiv.classList.add("hidden")
  }
}

async function addNewCard() {
  const cardNumber = document.getElementById("cardNumber").value
  const cardExpiry = document.getElementById("cardExpiry").value
  const cardCvc = document.getElementById("cardCvc").value
  const cardName = document.getElementById("cardName").value

  if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
    showError("wallet-error", "Please fill in all card details")
    return
  }

  const addButton = document.getElementById("add-card-submit")
  addButton.disabled = true
  addButton.innerHTML = '<div class="spinner mr-2"></div>Adding Card...'

  hideError("wallet-error")

  try {
    // Simulate card tokenization
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const newCard = {
      id: `card_${Date.now()}`,
      last4: cardNumber.slice(-4),
      brand: cardNumber.startsWith("4") ? "visa" : "mastercard",
      expMonth: cardExpiry.split("/")[0],
      expYear: cardExpiry.split("/")[1],
      name: cardName,
      createdAt: new Date().toISOString(),
    }

    savedCards.push(newCard)
    selectedCardId = newCard.id
    localStorage.setItem(`mochainaCards_${currentUser.id}`, JSON.stringify(savedCards))

    // Clear form
    document.getElementById("cardNumber").value = ""
    document.getElementById("cardExpiry").value = ""
    document.getElementById("cardCvc").value = ""
    document.getElementById("cardName").value = ""
    document.getElementById("add-card-form").classList.add("hidden")

    updateCardsDisplay()
  } catch (error) {
    showError("wallet-error", "Failed to add card. Please try again.")
  } finally {
      // Set next draw time
      nextDrawTime = getNextHourTimestamp();
      if (currentUser) {
        localStorage.setItem("mochainaNextDrawTime_" + currentUser.id, nextDrawTime.toISOString());
      }
  }
}

async function processStripePayment(amount, type) {
  if (!stripe || isStripeLoading) {
    showError("wallet-error", "Payment system is still loading. Please try again.")
    return false
  }

  if (!selectedCardId && savedCards.length === 0) {
    showError("wallet-error", "Please add a card first.")
    return false
  }

  paymentProcessing = true
  document.getElementById("deposit-btn").disabled = true
  document.getElementById("withdraw-btn").disabled = true
  document.getElementById("deposit-btn").innerHTML = '<div class="spinner mr-2"></div>Processing...'

  hideError("wallet-error")

  try {
    const selectedCard = savedCards.find((card) => card.id === selectedCardId)

    // Simulate payment process
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate payment success (90% success rate for demo)
    const isSuccess = Math.random() > 0.1

    if (isSuccess) {
      if (type === "deposit") {
        balance += amount
        localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
        updateBalance()
      }
      return true
    } else {
      throw new Error("Payment failed. Please try again.")
    }
  } catch (error) {
    showError("wallet-error", error.message || "Payment processing failed. Please try again.")
    return false
  } finally {
    paymentProcessing = false
    document.getElementById("deposit-btn").disabled = false
    document.getElementById("withdraw-btn").disabled = false
    document.getElementById("deposit-btn").innerHTML = "Deposit"
  }
}

async function processBankTransfer(amount, type) {
  paymentProcessing = true
  document.getElementById("deposit-btn").disabled = true
  document.getElementById("withdraw-btn").disabled = true
  document.getElementById("deposit-btn").innerHTML = '<div class="spinner mr-2"></div>Processing...'

  hideError("wallet-error")
  hideError("bank-error")

  // Validate bank details
  if (!bankDetails.accountNumber || !bankDetails.bankName || !bankDetails.accountHolder) {
    showError("bank-error", "Please fill in all bank details")
    paymentProcessing = false
    document.getElementById("deposit-btn").disabled = false
    document.getElementById("withdraw-btn").disabled = false
    document.getElementById("deposit-btn").innerHTML = "Deposit"
    return false
  }

  if (bankDetails.accountNumber.length < 8) {
    showError("bank-error", "Account number must be at least 8 digits")
    paymentProcessing = false
    document.getElementById("deposit-btn").disabled = false
    document.getElementById("withdraw-btn").disabled = false
    document.getElementById("deposit-btn").innerHTML = "Deposit"
    return false
  }

  try {
    // Simulate bank transfer processing
    await new Promise((resolve) => setTimeout(resolve, 1500))

    if (type === "deposit") {
      balance += amount
      localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
      updateBalance()

      alert(
        `Bank transfer initiated for R${amount.toFixed(2)} from ${bankDetails.bankName} account ending in ${bankDetails.accountNumber.slice(-4)}. Funds will be available within 1-3 business days. For demo purposes, funds have been added immediately.`,
      )
    } else {
      balance -= amount
      localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
      updateBalance()

      alert(
        `Withdrawal of R${amount.toFixed(2)} has been processed to ${bankDetails.bankName} account ending in ${bankDetails.accountNumber.slice(-4)}. Funds will be transferred within 1-3 business days.`,
      )
    }

    return true
  } catch (error) {
    showError("wallet-error", "Bank transfer processing failed. Please try again.")
    return false
  } finally {
    paymentProcessing = false
    document.getElementById("deposit-btn").disabled = false
    document.getElementById("withdraw-btn").disabled = false
    document.getElementById("deposit-btn").innerHTML = "Deposit"
  }
}

async function handleDeposit() {
  const amount = Number.parseFloat(document.getElementById("walletAmount").value)
  if (isNaN(amount) || amount <= 0) {
    showError("wallet-error", "Please enter a valid amount")
    return
  }

  if (amount < 10) {
    showError("wallet-error", "Minimum deposit amount is R10.00")
    return
  }

  let success = false
  if (paymentMethod === "card") {
    success = await processStripePayment(amount, "deposit")
  } else {
    success = await processBankTransfer(amount, "deposit")
  }

  if (success) {
    document.getElementById("walletAmount").value = ""
    hideError("wallet-error")
  }
}

async function handleWithdraw() {
  const amount = Number.parseFloat(document.getElementById("walletAmount").value)
  if (isNaN(amount) || amount <= 0) {
    showError("wallet-error", "Please enter a valid amount")
    return
  }

  if (amount > balance) {
    showError("wallet-error", "Insufficient funds")
    return
  }

  if (amount < 50) {
    showError("wallet-error", "Minimum withdrawal amount is R50.00")
    return
  }

  let success = false
  success = await processBankTransfer(amount, "withdraw")

  if (success) {
    document.getElementById("walletAmount").value = ""
    hideError("wallet-error")
  }
}

// Game functions
function createNumberButtons() {
  // Main numbers (1-50)
  const mainNumbers = document.getElementById("main-numbers")
  mainNumbers.innerHTML = ""

  for (let i = 1; i <= 50; i++) {
    const button = document.createElement("button")
    button.className = "number-ball"
    button.textContent = i
    button.onclick = () => handleNumberSelect(i)
    mainNumbers.appendChild(button)
  }

  // Bonus numbers (1-9)
  const bonusNumbers = document.getElementById("bonus-numbers")
  bonusNumbers.innerHTML = ""

  for (let i = 1; i <= 9; i++) {
    const button = document.createElement("button")
    button.className = "number-ball bonus-ball"
    button.textContent = i
    button.onclick = () => handleBonusSelect(i)
    bonusNumbers.appendChild(button)
  }
}

function handleNumberSelect(number) {
  if (selectedNumbers.includes(number)) {
    selectedNumbers = selectedNumbers.filter((n) => n !== number)
  } else if (selectedNumbers.length < 3) {
    selectedNumbers.push(number)
  }

  updateGameDisplay()
}

function handleBonusSelect(bonus) {
  selectedBonus = selectedBonus === bonus ? null : bonus
  updateGameDisplay()
}

function updateGameDisplay() {
  // Update number button states
  const mainButtons = document.querySelectorAll("#main-numbers .number-ball")
  mainButtons.forEach((button, index) => {
    const number = index + 1
    if (selectedNumbers.includes(number)) {
      button.classList.add("selected")
    } else {
      button.classList.remove("selected")
    }

    if (!selectedNumbers.includes(number) && selectedNumbers.length >= 3) {
      button.classList.add("disabled")
    } else {
      button.classList.remove("disabled")
    }
  })

  const bonusButtons = document.querySelectorAll("#bonus-numbers .number-ball")
  bonusButtons.forEach((button, index) => {
    const number = index + 1
    if (selectedBonus === number) {
      button.classList.add("selected")
    } else {
      button.classList.remove("selected")
    }
  })

  // Update selected numbers display
  document.getElementById("selected-main").textContent =
    selectedNumbers.length > 0 ? selectedNumbers.join(", ") : "None"
  document.getElementById("selected-bonus").textContent = selectedBonus || "None"

  // Update bet amount and payout estimate
  const betAmountValue = Number.parseFloat(document.getElementById("betAmount").value || 0)
  const addSlipBtn = document.getElementById("add-slip-btn")

  if (selectedNumbers.length === 3 && selectedBonus !== null && betAmountValue > 0) {
    addSlipBtn.disabled = false
    addSlipBtn.textContent = `Add to Betting Slips - R${betAmountValue.toFixed(2)}`

    // Show payout estimate
    const payoutEstimate = document.getElementById("payout-estimate")
    const mainPayout = betAmountValue * (40 / 3)
    const bonusPayout = betAmountValue * (47 / 3)

    document.getElementById("main-payout").textContent = `• 3 Main Numbers: R${mainPayout.toFixed(2)} (13.33x)`
    document.getElementById("bonus-payout").textContent = `• 3 Main + Bonus: R${bonusPayout.toFixed(2)} (15.67x)`
    payoutEstimate.classList.remove("hidden")
  } else {
    addSlipBtn.disabled = true
    addSlipBtn.textContent = `Add to Betting Slips - R${betAmountValue.toFixed(2)}`
    document.getElementById("payout-estimate").classList.add("hidden")
  }

  // Update betting slips display
  updateBettingSlipsDisplay()
}

function updateBettingSlipsDisplay() {
  const slipsSection = document.getElementById("betting-slips-section")
  const slipsList = document.getElementById("slips-list")

  if (bettingSlips.length > 0) {
    slipsSection.classList.remove("hidden")
    slipsList.innerHTML = ""

    if (nextDrawTime) {
      document.getElementById("next-auto-draw").textContent = ` Next draw: ${nextDrawTime.toLocaleString()}`
    }

    bettingSlips.forEach((slip, index) => {
      const slipDiv = document.createElement("div")
      slipDiv.className = "slip-item"
      slipDiv.innerHTML = `
                <div class="flex-1">
                    <p><strong>Slip #${index + 1}</strong></p>
                    <p>Numbers: ${slip.numbers.join(", ")} | Bonus: ${slip.bonus}</p>
                    <p><strong>Bet Amount:</strong> R${slip.amount.toFixed(2)}</p>
                    <div class="mt-2 text-sm text-gray-600">
                        <p><strong>Potential Payouts:</strong></p>
                        <p>• 3 Main Numbers: R${slip.estimatedPayouts.mainNumbersWin.toFixed(2)}</p>
                        <p>• 3 Main + Bonus: R${slip.estimatedPayouts.mainPlusBonusWin.toFixed(2)}</p>
                    </div>
                </div>
                <button onclick="removeBettingSlip(${slip.id})" class="btn btn-outline btn-sm">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            `
      slipsList.appendChild(slipDiv)
    })
  } else {
    slipsSection.classList.add("hidden")
  }
}

function calculateEstimatedWinnings(amount) {
  const mainNumbersRatio = 40 / 3 // 13.33x
  const mainPlusBonusRatio = 47 / 3 // 15.67x

  return {
    mainNumbersWin: amount * mainNumbersRatio,
    mainPlusBonusWin: amount * mainPlusBonusRatio,
  }
}

function addBettingSlip() {
  if (selectedNumbers.length !== 3 || selectedBonus === null) {
    showError("game-error", "Please select 3 main numbers and 1 bonus number")
    return
  }

  const amount = Number.parseFloat(document.getElementById("betAmount").value)
  if (isNaN(amount) || amount <= 0) {
    showError("game-error", "Please enter a valid bet amount")
    return
  }

  if (amount > balance) {
    showError("game-error", "Insufficient funds")
    return
  }

  const newSlip = {
    id: Date.now(),
    numbers: [...selectedNumbers],
    bonus: selectedBonus,
    amount: amount,
    estimatedPayouts: calculateEstimatedWinnings(amount),
    timestamp: new Date().toISOString(),
  }

  // Deduct bet amount from balance immediately
  balance -= amount
  localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
  updateBalance()

  bettingSlips.push(newSlip)
  localStorage.setItem("mochainaBettingSlips_" + currentUser.id, JSON.stringify(bettingSlips))

  selectedNumbers = []
  selectedBonus = null
  document.getElementById("betAmount").value = "3.00"
  hideError("game-error")

  updateGameDisplay()
}

function removeBettingSlip(slipId) {
  // Find the slip to remove
  const slipIndex = bettingSlips.findIndex((slip) => slip.id === slipId);
  if (slipIndex === -1) return;
  const slip = bettingSlips[slipIndex];
  // Remove the slip
  bettingSlips.splice(slipIndex, 1);
  localStorage.setItem("mochainaBettingSlips_" + currentUser.id, JSON.stringify(bettingSlips));
  // Refund amount minus R1
  let refund = slip.amount - 1;
  if (refund < 0) refund = 0;
  balance += refund;
  localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString());
  updateBalance();
  updateGameDisplay();
}

function playAllSlips() {
  if (bettingSlips.length === 0) {
    showError("game-error", "No betting slips to play")
    return
  }

  const totalCost = bettingSlips.reduce((sum, slip) => sum + slip.amount, 0)

  if (totalCost > balance) {
    showError("game-error", "Insufficient funds for all betting slips")
    return
  }

  // Deduct total cost from balance
  balance -= totalCost
  localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
  updateBalance()

  // Generate random draw (same for all slips)
  const drawnNumbers = []
  while (drawnNumbers.length < 3) {
    const num = Math.floor(Math.random() * 50) + 1
    if (!drawnNumbers.includes(num)) {
      drawnNumbers.push(num)
    }
  }
  const drawnBonus = Math.floor(Math.random() * 9) + 1

  // Process each betting slip
  const results = bettingSlips.map((slip) => {
    const matchingNumbers = slip.numbers.filter((num) => drawnNumbers.includes(num)).length
    const bonusMatch = slip.bonus === drawnBonus

    let totalWinnings = 0
    let winType = "no_win"

    if (matchingNumbers === 3 && bonusMatch) {
      totalWinnings = slip.amount * (47 / 3) // 15.67x ratio
      winType = "main_plus_bonus"
    } else if (matchingNumbers === 3) {
      totalWinnings = slip.amount * (40 / 3) // 13.33x ratio
      winType = "main_numbers"
    }

    return {
      slipId: slip.id,
      slip: slip,
      drawnNumbers,
      drawnBonus,
      matchingNumbers,
      bonusMatch,
      winType,
      totalWinnings,
      timestamp: new Date().toISOString(),
    }
  })

  // Add winnings to balance immediately
  const totalWinnings = results.reduce((sum, result) => sum + result.totalWinnings, 0)
  if (totalWinnings > 0) {
    balance += totalWinnings
    localStorage.setItem("mochainaBalance_" + currentUser.id, balance.toString())
    updateBalance()
  }

  // Store results and clear betting slips
  gameResults = results
  bettingSlips = []
  localStorage.setItem("mochainaBettingSlips_" + currentUser.id, JSON.stringify([]))
  localStorage.setItem("mochainaGameResults_" + currentUser.id, JSON.stringify(results))
  hideError("game-error")

  updateGameDisplay()
  updateResultsDisplay()
}

function clearAllSlips() {
  bettingSlips = []
  localStorage.setItem("mochainaBettingSlips_" + currentUser.id, JSON.stringify([]))
  updateGameDisplay()
}

function updateResultsDisplay() {
  const resultsSection = document.getElementById("game-results")
  const resultsList = document.getElementById("results-list")
  const totalWinningsDiv = document.getElementById("total-winnings")
  const winningsAdded = document.getElementById("winnings-added")

  if (gameResults.length > 0) {
    resultsSection.classList.remove("hidden")

    if (gameResults[0]) {
      document.getElementById("results-description").textContent =
        `Drawn Numbers: ${gameResults[0].drawnNumbers.join(", ")} | Bonus: ${gameResults[0].drawnBonus}`
    }

    resultsList.innerHTML = ""
    let totalWinnings = 0

    gameResults.forEach((result, index) => {
      totalWinnings += result.totalWinnings

      const resultDiv = document.createElement("div")
      resultDiv.className = `result-item ${result.totalWinnings > 0 ? "win" : ""}`
      resultDiv.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <p><strong>Slip #${index + 1}</strong></p>
                        <p>Your Numbers: ${result.slip.numbers.join(", ")} | Bonus: ${result.slip.bonus}</p>
                        <p><strong>Bet Amount:</strong> R${result.slip.amount.toFixed(2)}</p>
                        <div class="mt-2 text-sm">
                            <p><strong>Potential Payouts:</strong></p>
                            <p>• 3 Main Numbers: R${result.slip.estimatedPayouts.mainNumbersWin.toFixed(2)}</p>
                            <p>• 3 Main + Bonus: R${result.slip.estimatedPayouts.mainPlusBonusWin.toFixed(2)}</p>
                        </div>
                        <p class="mt-2"><strong>Result:</strong> ${result.matchingNumbers}/3 main numbers ${result.bonusMatch ? "+ bonus match" : ""}</p>
                    </div>
                    <div class="text-right">
                        ${
                          result.totalWinnings > 0
                            ? `
                            <div class="text-green-600 font-bold">
                                <p class="text-lg">WON!</p>
                                <p class="text-xl">R${result.totalWinnings.toFixed(2)}</p>
                                <p class="text-sm font-normal">(${result.winType === "main_plus_bonus" ? "15.67x" : "13.33x"} payout)</p>
                            </div>
                        `
                            : `
                            <div class="text-gray-500">
                                <p class="text-lg">No Win</p>
                                <p class="text-sm">R0.00</p>
                            </div>
                        `
                        }
                    </div>
                </div>
            `
      resultsList.appendChild(resultDiv)
    })

    totalWinningsDiv.querySelector("p").textContent = `Total Winnings: R${totalWinnings.toFixed(2)}`

    if (totalWinnings > 0) {
      winningsAdded.classList.remove("hidden")
    } else {
      winningsAdded.classList.add("hidden")
    }
  } else {
    resultsSection.classList.add("hidden")
  }
}

function clearResults() {
  gameResults = []
  localStorage.setItem("mochainaGameResults_" + currentUser.id, JSON.stringify([]))
  updateResultsDisplay()
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Stripe
  initializeStripe()

  // Theme toggle
  document.getElementById("theme-toggle").addEventListener("click", () => {
    darkMode = !darkMode
    updateTheme()
  })

  // Navigation
  document.getElementById("go-to-login").addEventListener("click", () => showPage("login"))
  document.getElementById("go-to-register").addEventListener("click", () => showPage("register"))
  document.getElementById("wallet-nav").addEventListener("click", () => showPage("wallet"))
  document.getElementById("game-nav").addEventListener("click", () => showPage("game"))
  document.getElementById("logout-btn").addEventListener("click", logout)

  // Forms
  document.getElementById("register-form").addEventListener("submit", handleRegisterSubmit)
  document.getElementById("login-form").addEventListener("submit", handleLoginSubmit)

  // Payment method toggle
  document.getElementById("card-method").addEventListener("click", function () {
    paymentMethod = "card"
    this.classList.add("btn-primary")
    this.classList.remove("btn-outline")
    document.getElementById("bank-method").classList.add("btn-outline")
    document.getElementById("bank-method").classList.remove("btn-primary")
    document.getElementById("card-section").classList.remove("hidden")
    document.getElementById("bank-section").classList.add("hidden")
  })

  document.getElementById("bank-method").addEventListener("click", function () {
    paymentMethod = "bank"
    this.classList.add("btn-primary")
    this.classList.remove("btn-outline")
    document.getElementById("card-method").classList.add("btn-outline")
    document.getElementById("card-method").classList.remove("btn-primary")
    document.getElementById("card-section").classList.add("hidden")
    document.getElementById("bank-section").classList.remove("hidden")
  })

  // Card management
  document.getElementById("add-card-btn").addEventListener("click", () => {
    const form = document.getElementById("add-card-form")
    form.classList.toggle("hidden")
  })

  document.getElementById("add-card-submit").addEventListener("click", addNewCard)

  // Bank details
  document.getElementById("bankName").addEventListener("change", (e) => {
    bankDetails.bankName = e.target.value
  })

  document.getElementById("accountHolder").addEventListener("input", (e) => {
    bankDetails.accountHolder = e.target.value
  })

  document.getElementById("accountNumber").addEventListener("input", (e) => {
    bankDetails.accountNumber = e.target.value.replace(/\D/g, "").slice(0, 16)
    e.target.value = bankDetails.accountNumber
  })

  // Wallet actions
  document.getElementById("deposit-btn").addEventListener("click", handleDeposit)
  document.getElementById("withdraw-btn").addEventListener("click", handleWithdraw)

  // Card number formatting
  document.getElementById("cardNumber").addEventListener("input", (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 16)
    const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ")
    e.target.value = formatted
  })

  document.getElementById("cardExpiry").addEventListener("input", (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4)
    const formatted = value.replace(/(\d{2})(?=\d)/, "$1/")
    e.target.value = formatted
  })

  document.getElementById("cardCvc").addEventListener("input", (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 3)
    e.target.value = value
  })

  // Game
  createNumberButtons()

  document.getElementById("betAmount").addEventListener("input", () => {
    updateGameDisplay()
  })

  document.getElementById("add-slip-btn").addEventListener("click", addBettingSlip)
  document.getElementById("play-all-btn").addEventListener("click", playAllSlips)
  document.getElementById("clear-all-btn").addEventListener("click", clearAllSlips)
  document.getElementById("clear-results-btn").addEventListener("click", clearResults)

  // Initialize theme
  updateTheme()
})

// Global functions for inline event handlers
window.removeBettingSlip = removeBettingSlip
