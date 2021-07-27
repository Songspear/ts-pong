import { interval, fromEvent } from 'rxjs';
import {map, merge, filter, scan, take} from'rxjs/operators';

function pong() {
  const doc = document.getElementById("canvas")!;
  const ball = document.getElementById("ball")!;
  const
      Constants = new class{
        readonly canvasWidth = 1200;
        readonly canvasHeight = 600;
        readonly ballVelocityInitial = 5;
        readonly paddleVelocity = 5;
        readonly maxScore = 7;
        readonly paddleWidth=10;
        readonly paddleHeight=150;
        readonly ballVelocityMultiplier = 1.5
      };
  
  type Key = 'ArrowUp' | 'ArrowDown' | 'KeyR'
  type Event = 'keydown' | 'keyup'


  type Ball = Readonly<{
    id: string,
    width:number,
    height:number,
    loc: Vec,
    vel: Vec,
  }>
  type Paddle = Readonly<{
    id: string,
    loc: Vec,
    vel: Vec,
  }>

  type State = Readonly<{
    aiPaddle: Paddle,
    playerPaddle: Paddle,
    ball: Ball,
    aiScore: number,
    playerScore: number,
    gameOver:boolean,

  }>

  const getBall = () => <Ball>{
      id: 'ball',
      width: 20,
      height: 20,
      loc: new Vec(Constants.canvasWidth/2, Constants.canvasHeight/2),
      vel: new Vec(Constants.ballVelocityInitial,Constants.ballVelocityInitial)
  },

  /**
   * returns a paddle object
   * @param obj : object id
   * @param loc : location of paddle
   */
  getPaddle = (obj:string,loc:Vec) => <Paddle>{
      id:obj,
      vel: new Vec(0, 0),
      loc: loc
  },
  /**
   * code to stop paddle from moving below/above canvas.
   * @param param0 vector of paddle
   */
  paddleStop = ({x,y}:Vec) => { 
    const s=Constants.canvasHeight, 
      wrap = (v:number) => v - Constants.paddleHeight/2 <= 0 ? v = Constants.paddleHeight/2 : v+Constants.paddleHeight/2 > s ? v = s-Constants.paddleHeight/2 : v;
    return new Vec(x,wrap(y))
  },
  /**
   * checks for keypresses.
   */
  keyObs = <T>(e:Event, k:Key, result:()=>T)=>
    fromEvent<KeyboardEvent>(document,e)
        .pipe(
          filter(({code})=>code === k),
          filter(({repeat})=>!repeat),
          map(result)),
    paddleUp = keyObs('keydown','ArrowUp', ()=>new Vec(0, -Constants.paddleVelocity)),
    stopUp = keyObs('keyup','ArrowUp', ()=>new Vec(0, 0)),
    paddleDown = keyObs('keydown','ArrowDown',()=>new Vec(0, Constants.paddleVelocity)),
    stopDown = keyObs('keyup','ArrowDown', ()=>new Vec(0, 0)),
    restart = keyObs('keydown', 'KeyR', () => pong())

  const
  /**
   * initial state of the game
   */
    initialState:State = {
      aiPaddle: getPaddle('aiPaddle',(new Vec(50, Constants.canvasHeight/2))),
      playerPaddle: getPaddle('playerPaddle',(new Vec(1150, Constants.canvasHeight/2))),
      ball: getBall(),
      aiScore: 0,
      playerScore:0,
      gameOver: false,
    },
    /**
     * computer paddle logic. calculates location and trajectory of ball to determine paddle velocity.
     */
    aiPaddleVel = (b:Ball, p: Paddle) =><Paddle>{
      ...p,
      vel: new Vec(p.vel.x,b.loc.x < Constants.canvasWidth/(Constants.paddleVelocity + 2)? (b.loc.y < p.loc.y ? -Constants.paddleVelocity
      :(b.loc.y > p.loc.y ? Constants.paddleVelocity : 0))
      :0)
    },
    moveBall = (o:Ball) => <Ball>{
      ...o,
      loc: o.loc.add(o.vel)
    },
    movePaddle = (p: Paddle) => <Paddle>{
      ...p,
      loc: paddleStop(p.loc.add(p.vel))
    },
    /**
     * collision handling
     */
    handleCollisions = (s:State) => {
      const
        bodiesCollided = (a:Paddle,b:Ball) => (Math.abs(b.loc.x - a.loc.x) <= Constants.paddleWidth/2)&& (Math.abs(b.loc.x - a.loc.x) >= 0)
         && (b.loc.y < a.loc.y + 5 + Constants.paddleHeight/2)&&(b.loc.y > a.loc.y - 5 - Constants.paddleHeight/2), // checks if ball is touching paddle
        updateBall = (b:Ball,v: Vec) => <Ball>{...b,vel: v},
        paddleYResolve = (p: Paddle, b:Ball) =>{//changes y velocity of ball based on paddle location hit.
          const 
            distance = p.loc.y - b.loc.y,//gets distance of ball from paddle centre. ranges from -75 to 75
            scale = -(distance/(Constants.paddleHeight/5)) // changes the distance into a usable scale
            return (scale * Constants.ballVelocityMultiplier * Constants.ballVelocityInitial) //changes y velocity
        },//updates ball velocity
        playerPaddleCollide = bodiesCollided(s.playerPaddle, s.ball),
        aiPaddleCollide = bodiesCollided(s.aiPaddle, s.ball),
        paddleCollided = playerPaddleCollide || aiPaddleCollide,
        
        collideWall = s.ball.loc.y <= 0 || s.ball.loc.y >= Constants.canvasHeight,
        collideRight = s.ball.loc.x > Constants.canvasWidth,
        collideLeft = s.ball.loc.x < 0,
        xDirection = paddleCollided ? -1 *  s.ball.vel.x: s.ball.vel.x ,
        yDirection =   collideWall ? -s.ball.vel.y
        :playerPaddleCollide? paddleYResolve(s.playerPaddle, s.ball)
        :aiPaddleCollide? paddleYResolve(s.aiPaddle, s.ball)
        :s.ball.vel.y, //resolves y axis of ball depending on collision type (wall, playerPaddle or aiPaddle)

        direction = new Vec(xDirection,yDirection),
        ballUpdate = collideLeft||collideRight? getBall() : updateBall(s.ball,direction), // updates ball or resets ball location based when someone scores
        playerPaddleUpdate = collideLeft||collideRight? getPaddle('playerPaddle',(new Vec(1150, Constants.canvasHeight/2))):movePaddle(s.playerPaddle),// updates or resets player paddle location based when someone scores
        aiPaddleUpdate = collideLeft||collideRight? getPaddle('aiPaddle',(new Vec(50, Constants.canvasHeight/2))):movePaddle(s.aiPaddle),// updates or resets computer paddle location based when someone scores
        updatePlayerScore = collideLeft ? s.playerScore + 1 : s.playerScore,
        updateaiScore = collideRight ? s.aiScore + 1 : s.aiScore,
        reachMaxScore = updatePlayerScore >= Constants.maxScore || updateaiScore >= Constants.maxScore
      return <State>{
        ...s,
        ball: ballUpdate,
        playerPaddle: playerPaddleUpdate,
        aiPaddle: aiPaddleUpdate,
        aiScore: updateaiScore,
        playerScore:updatePlayerScore,
        gameOver: reachMaxScore 
      }
    },
    /**
     * updates time passed
     */
    tick = (s:State) => {
      return handleCollisions({...s,
        playerPaddle:movePaddle(s.playerPaddle),
        aiPaddle:movePaddle(aiPaddleVel(s.ball, s.aiPaddle)),
        ball:moveBall(s.ball),
      })
    },
    reduceState = (s:State, e:Vec|null) =>
      e instanceof Vec ? { ...s,
        playerPaddle:{...s.playerPaddle, vel:e} //handles player input
      }:
      tick(s)// handles time passing

  const subscription = interval(10).pipe(
    merge(paddleUp, stopUp, stopDown, paddleDown),
    scan(reduceState, initialState)
  ).subscribe(updateView);

  /**
   * updates view in html
   * @param s State of the game
   */
  function updateView(s: State){
    const
      canvas = document.getElementById("Canvas")!,
      playerPaddle = document.getElementById("playerPaddle")!,
      aiPaddle = document.getElementById("aiPaddle")!,
      ball = document.getElementById("ball")!,
      score = document.getElementById("score"),
      gameOverProcess = (ps: number,as:number) =>{//determines if player or computer won
        const winner = ps > as? "Player": "Computer"
        return (winner + " won.")
      },
      attr = (e:Element, o:any) =>
      {for(const k in o) e.setAttribute(k, String(o[k]))} 

    attr(playerPaddle, {transform : `translate(${s.playerPaddle.loc.x},${s.playerPaddle.loc.y})`})
    attr(aiPaddle, {transform : `translate(${s.aiPaddle.loc.x},${s.aiPaddle.loc.y})`})
    attr(ball, {transform: `translate(${s.ball.loc.x},${s.ball.loc.y})`})
    score.innerHTML = (`${s.aiScore} : ${s.playerScore}`);
    if(s.gameOver){ //unsubscribes all active subscriptions (subscriptions in this case). created a 1 time subscription that checks if player wants to restart game
      subscription.unsubscribe();
      score.innerHTML = (gameOverProcess(s.playerScore,s.aiScore))
      restart.pipe(take(1)).subscribe()
      }
  }
}

class Vec{
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
}
  

// the following simply runs your pong function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
  window.onload = ()=>{
    pong();
  }