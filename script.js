const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');
const restartBtn = document.getElementById('restart');
const nextRoundBtn = document.getElementById('next-round');
const pvpBtn = document.getElementById('pvp');
const aiBtn = document.getElementById('ai');
const moveHistoryEl = document.getElementById('move-history');
const probTextEl = document.getElementById('prob-text');
const strategyEl = document.getElementById('strategy');
const scoreXEl = document.getElementById('score-x');
const scoreOEl = document.getElementById('score-o');
const scoreDEl = document.getElementById('score-d');

let board = ["","","","","","","","",""];
let currentPlayer = "X";
let gameActive = false;
let vsAI = false;
let moves = []; // {player,index}
let scores = { X: 0, O: 0, D: 0 };

/* winning combos */
const winningConditions = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

let probChart, scoreChart;
function initCharts(){
  const probCtx = document.getElementById('probChart').getContext('2d');
  probChart = new Chart(probCtx, {
    type: 'pie',
    data: {
      labels: ['X','O','Draw'],
      datasets: [{
        data: [33,33,34],
        backgroundColor: ['#7dd3fc','#ff8fb1','#9aa7ff'],
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1
      }]
    },
    options:{ plugins:{legend:{position:'bottom',labels:{color:'#dff7ff'}}} }
  });

  const scoreCtx = document.getElementById('scoreChart').getContext('2d');
  scoreChart = new Chart(scoreCtx, {
    type: 'bar',
    data: {
      labels: ['X','O','Draws'],
      datasets: [{
        label: 'Matches',
        data: [0,0,0],
        backgroundColor: ['#7dd3fc','#ff8fb1','#9aa7ff']
      }]
    },
    options:{
      plugins:{legend:{display:false}},
      scales:{
        y:{ beginAtZero:true, ticks:{color:'#dff7ff'} },
        x:{ ticks:{color:'#dff7ff'} }
      }
    }
  });
}

pvpBtn.addEventListener('click', () => startGame(false));
aiBtn.addEventListener('click', () => startGame(true));
restartBtn.addEventListener('click', () => resetMatch());
nextRoundBtn.addEventListener('click', () => startNextRound());

cells.forEach(cell => cell.addEventListener('click', handleCellClick));

function startGame(aiMode){
  vsAI = aiMode;
  startNextRound();
}

function startNextRound(){
  board = ["","","","","","","","",""];
  moves = [];
  currentPlayer = "X";
  gameActive = true;
  statusText.textContent = `Player ${currentPlayer}'s turn`;
  cells.forEach(cell => {
    cell.textContent = "";
    cell.classList.remove('taken','win','x','o');
  });
  updateMoveHistory();
  updateAnalysis(); // initialize charts/tips
}

/* reset entire match (scores too) */
function resetMatch(){
  scores = { X:0, O:0, D:0 };
  updateScoreUI();
  scoreChart.data.datasets[0].data = [0,0,0];
  scoreChart.update();
  startNextRound();
}

function handleCellClick(e){
  const index = Number(e.target.dataset.index);
  if(!gameActive || board[index] !== "") return;

  placeMove(index, currentPlayer);
  applyCellVisual(index, currentPlayer);
  moves.push({player: currentPlayer, index});
  updateMoveHistory();
  if(checkWinner()){
    endRound(currentPlayer);
    return;
  }
  if(!board.includes("")){
    endRound('D'); // draw
    return;
  }
  currentPlayer = currentPlayer === "X"? "O":"X";
  statusText.textContent = `Player ${currentPlayer}'s turn`;
  updateAnalysis();

  if(vsAI && currentPlayer === "O" && gameActive){
    setTimeout(() => {
      const best = minimax(board.slice(), 'O').index;
      placeMove(best, 'O');
      applyCellVisual(best, 'O');
      moves.push({player:'O', index: best});
      updateMoveHistory();
      if(checkWinner()){
        endRound('O'); return;
      }
      if(!board.includes("")){
        endRound('D'); return;
      }
      currentPlayer = 'X';
      statusText.textContent = `Player ${currentPlayer}'s turn`;
      updateAnalysis();
    }, 320);
  }
}

function placeMove(index, player){
  board[index] = player;
}

/* show X/O with color classes */
function applyCellVisual(index, player){
  const el = document.querySelector(`.cell[data-index='${index}']`);
  el.textContent = player;
  el.classList.add('taken');
  el.classList.add(player.toLowerCase());
}

/* -------------------------
   Winner checking & end
   ------------------------- */
function checkWinner(){
  for(const c of winningConditions){
    const [a,b,c2] = c;
    if(board[a] && board[a] === board[b] && board[a] === board[c2]){
      highlightWinningCells(c);
      return true;
    }
  }
  return false;
}

function highlightWinningCells(indices){
  indices.forEach(i => {
    const el = document.querySelector(`.cell[data-index='${i}']`);
    el.classList.add('win');
  });
}

function endRound(winner){
  gameActive = false;
  if(winner === 'D'){
    statusText.textContent = "It's a draw! 🤝";
    scores.D++;
  } else {
    statusText.textContent = `Player ${winner} wins! 🎉`;
    scores[winner]++;
  }
  updateScoreUI();
  updateAnalysis(); // final update (probabilities, strategy)
  scoreChart.data.datasets[0].data = [scores.X, scores.O, scores.D];
  scoreChart.update();
}

function updateMoveHistory(){
  moveHistoryEl.innerHTML = '';
  moves.forEach((m, i) => {
    const li = document.createElement('li');
    li.textContent = `${i+1}. ${m.player} → ${indexToCoord(m.index)}`;
    moveHistoryEl.appendChild(li);
  });
}

function indexToCoord(i){
  const cols = ['A','B','C'];
  const row = Math.floor(i/3)+1;
  return `${cols[i%3]}${row}`;
}

function updateAnalysis(){
  // update probability chart
  const scoreForO = minimax(board.slice(), 'O').score; // -10,0,10
  // map to percentages (coarse heuristic)
  let pctO=33, pctX=33, pctD=34;
  if(scoreForO === 10){ pctO=85; pctX=10; pctD=5; }
  else if(scoreForO === 0){ pctO=35; pctX=35; pctD=30; }
  else if(scoreForO === -10){ pctO=10; pctX=85; pctD=5; }
  // Slight adjust toward center control and material moves:
  // if center taken by X, favor X slightly
  if(board[4] === 'X' && scoreForO === 0){ pctX += 8; pctO -= 4; pctD -=4; }
  if(board[4] === 'O' && scoreForO === 0){ pctO += 8; pctX -= 4; pctD -=4; }

  // normalize quick
  const total = pctO + pctX + pctD;
  pctO = Math.round((pctO/total)*100);
  pctX = Math.round((pctX/total)*100);
  pctD = 100 - pctO - pctX;

  probChart.data.datasets[0].data = [pctX, pctO, pctD];
  probChart.update();
  probTextEl.textContent = `X: ${pctX}% • O: ${pctO}% • Draw: ${pctD}%`;

  // Strategy tips (simple heuristics)
  strategyEl.innerHTML = generateStrategy();
}

/* produce tips based on current board */
function generateStrategy(){
  if(!gameActive){
    return `<strong>Round ended.</strong> Start new round or continue learning from the move history.`;
  }

  // If opening move and center free
  if(moves.length === 0){
    return `Opening tip: Take the center (B2) to maximize control.`;
  }
  // If center free and current player
  if(board[4] === "" ){
    return `Good chance: Take center (B2) if available. It gives the most winning lines.`;
  }

  // If opponent has 2-in-row and third empty -> recommend block
  const opponent = currentPlayer === 'X' ? 'O' : 'X';
  const threat = findImmediateThreat(opponent);
  if(threat !== null){
    return `Urgent: Opponent (${opponent}) has a winning threat. Block at ${indexToCoord(threat)}.`;
  }

  // If we can win immediately
  const winningMove = findImmediateThreat(currentPlayer);
  if(winningMove !== null){
    return `You can win now! Play at ${indexToCoord(winningMove)} to finish the game.`;
  }

  // If fork opportunity (simple check: create two non-blockable lines)
  const fork = findForkOpportunity(currentPlayer);
  if(fork !== null){
    return `Fork opportunity: Play at ${indexToCoord(fork)} to create two threats.`;
  }

  return `No immediate threats. Prefer corners (A1, A3, C1, C3) if free, then edges.`;
}

/* find cell index where 'player' has immediate winning move (or opponent) */
function findImmediateThreat(player){
  for(let combo of winningConditions){
    const [a,b,c] = combo;
    const vals = [board[a],board[b],board[c]];
    const countPlayer = vals.filter(v=>v===player).length;
    const countEmpty = vals.filter(v=>v==="").length;
    if(countPlayer === 2 && countEmpty === 1){
      if(board[a] === "") return a;
      if(board[b] === "") return b;
      if(board[c] === "") return c;
    }
  }
  return null;
}

/* simple fork detection - try each empty cell, count number of immediate winning moves after placing there */
function findForkOpportunity(player){
  const empties = board.map((v,i)=> v===""?i:null).filter(v=>v!==null);
  for(const pos of empties){
    const copy = board.slice();
    copy[pos] = player;
    let winningMoves = 0;
    for(const combo of winningConditions){
      const [a,b,c] = combo;
      const vals = [copy[a],copy[b],copy[c]];
      const countPlayer = vals.filter(v=>v===player).length;
      const countEmpty = vals.filter(v=>v==="").length;
      if(countPlayer===2 && countEmpty===1) winningMoves++;
    }
    if(winningMoves >= 2) return pos;
  }
  return null;
}

function minimax(newBoard, player){
  // Check for terminal states
  if(checkWinState(newBoard, 'X')) return {score:-10};
  if(checkWinState(newBoard, 'O')) return {score:10};
  if(newBoard.every(s => s !== "")) return {score:0};

  const avail = newBoard.map((v,i)=> v===""? i : null ).filter(v=> v!==null);
  const movesLocal = [];

  for(const i of avail){
    const moveObj = {};
    moveObj.index = i;
    newBoard[i] = player;

    if(player === 'O'){
      const result = minimax(newBoard, 'X');
      moveObj.score = result.score;
    } else {
      const result = minimax(newBoard, 'O');
      moveObj.score = result.score;
    }

    newBoard[i] = "";
    movesLocal.push(moveObj);
  }

  // choose best depending on player
  let bestMoveIndex = 0;
  if(player === 'O'){
    let bestScore = -Infinity;
    for(let i=0;i<movesLocal.length;i++){
      if(movesLocal[i].score > bestScore){
        bestScore = movesLocal[i].score;
        bestMoveIndex = i;
      }
    }
  } else {
    let bestScore = Infinity;
    for(let i=0;i<movesLocal.length;i++){
      if(movesLocal[i].score < bestScore){
        bestScore = movesLocal[i].score;
        bestMoveIndex = i;
      }
    }
  }

  return movesLocal[bestMoveIndex];
}

function checkWinState(bd, player){
  return winningConditions.some(([a,b,c]) => bd[a]===player && bd[b]===player && bd[c]===player);
}

/* -------------------------
   UI: Scores & small helpers
   ------------------------- */
function updateScoreUI(){
  scoreXEl.textContent = scores.X;
  scoreOEl.textContent = scores.O;
  scoreDEl.textContent = scores.D;
}

/* initialize everything on page load */
window.addEventListener('load', () => {
  initCharts();
  startNextRound();
});
