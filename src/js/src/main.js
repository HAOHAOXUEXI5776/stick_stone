import Phaser from '../libs/phaser-wx.js'
import '../libs/weapp-adapter.js'

let game = new Phaser.Game({
    width: canvas.width,
    height: canvas.height,
    canvas: canvas,
    renderer: Phaser.CANVAS,
    backgroundColor: 0x0345cc
});

game.my_state = {};

game.utils = {
    // 一些公用函数
    toCloseInt: function (n) {
        let floor = Math.floor(n), ceil = Math.ceil(n);
        if (floor === -0) floor = 0;
        if (ceil === -0) ceil = 0;
        return n - floor < ceil - n ? floor : ceil;
    },

    copyArray(s){
        // s 为二维数组
        let d =[];
        for(let i = 0; i < s.length; i++)
            d.push(s[i].slice(0));
        return d;
    },

    isSame: function(a1, a2){
        // 判断两个同维度的二维数据是否相等
        for(let i = 0; i < a1.length; i++){
            for(let j = 0; j < a1[0].length; j++){
                if(a1[i][j] !== a2[i][j])
                    return false;
            }
        }
        return true;
    },

    sleep: function(ms){
        return new Promise((resolve) => setTimeout(resolve, ms));
    },

}

game.my_state.load = {
    preload: function () {
        // 注意，加载图片的时候，用x.png可以引用到x.PNG，但是预览的时候x.PNG不会上传
        // ，故需要引用名和文件名一致。
        let assets_dir = 'assets/';
        game.load.image('bg', assets_dir + 'bg400-700.png');
        game.load.image('m2p_btn', assets_dir + 'm2p_btn.png');
        game.load.image('p2p_btn', assets_dir + 'p2p_btn.png');
        game.load.image('about_btn', assets_dir + 'about_btn.png');
        game.load.image('about', assets_dir + 'about400-700.png');
        game.load.image('start_btn', assets_dir + 'start_btn.png');
        game.load.image('replay_btn', assets_dir + 'replay_btn.png');
        game.load.image('black_piece', assets_dir + 'black_piece.png');
        game.load.image('white_piece', assets_dir + 'white_piece.png');
        game.load.image('chosen', assets_dir + 'chosen.png');
        game.load.image('board', assets_dir + 'board.png');
        // 不能在这里preload中启动下一个状态，这会导致找不加载的东西
        // 同样，也不能在这里使用game.cache来获取缓存里的东西
    },
    create: function () {
        game.state.start('start');
    }
};

game.my_state.start = {
    create: function () {
        // 加载背景图片，并且让背景图片和屏幕大小一致
        let bg = game.add.image(0, 0, 'bg');
        bg.width = game.width;
        bg.height = game.height;
        // 开始界面的若干个按钮
        let btn = game.cache.getImage('m2p_btn');
        let btn_height = btn.height, btn_width = btn.width;
        game.add.button(game.width / 2 - btn_width / 2, game.height / 4, 'm2p_btn',
            this.onM2PBtn, this);
        game.add.button(game.width / 2 - btn_width / 2, game.height / 4 + btn_height + 50,
            'p2p_btn', this.onP2PBtn, this);
        game.add.button(game.width / 2 - btn_width / 2, game.height / 4 + 2 * (btn_height + 50),
            'about_btn', this.onAboutBtn, this);

        // 设置一些全局信息
        let board = game.cache.getImage('board');
        game.board = board;
        game.board_pos = [game.width / 2 - board.width / 2 + 15, game.height / 2 - board.height / 2 + 15]; //棋盘的左上角的坐标
        game.grid_size = 100; // 格子的宽和高均为100
        game.id2piece = ['black_piece', 'white_piece']; // 0和1对应两种棋
        game.id2name = ['黑方', '白方'];
        game.outx = [game.width * 0.4, game.width * 0.6];
        game.outy = [game.height * 0.85, game.height * 0.85];
        game.piece = [game.cache.getImage(game.id2piece[0]), game.cache.getImage(game.id2piece[1])];
        game.blank = 2; //代表空位置

        // quickly
        // game.state.start('play');

    },

    onM2PBtn: function () {
        console.log('进入人机对战');
        game.ism2p = true;
        game.state.start('play');

    },

    onP2PBtn: function () {
        console.log('进入人人对战');
        game.ism2p = false;
        game.state.start('play');

    },

    onAboutBtn: function () {
        console.log('进入关于界面');
        game.state.start('about');
    }
};

game.my_state.play = {
    create: function () {
        // 加载背景图片，并且让背景图片和屏幕大小一致
        let bg = game.add.image(0, 0, 'bg');
        bg.width = game.width;
        bg.height = game.height;
        // 回到开始界面按钮
        game.add.button(50, 25, 'start_btn', this.onStartBtn, this);
        // 重玩按钮
        game.add.button(180, 20, 'replay_btn', this.onReplayBtn, this);
        // 棋盘
        this.board = game.add.image(game.width / 2 - game.board.width / 2, game.height / 2 - game.board.height / 2, 'board');
        // 存放棋子的对象池
        this.pieces = [game.add.group(), game.add.group()];
        this.out_pieces = []; // 保存被丢掉的棋子的对象
        // 选中框：当选中一个子时，为其裱上一层框，以突出显示
        this.piece_box = game.add.image(game.board_pos[0], game.board_pos[1], 'chosen');
        this.piece_box.anchor.setTo(0.5, 0.5);
        this.piece_box.visible = false;
        // 在棋盘上增加对鼠标点击的检测
        this.board.inputEnabled = true;
        this.board.events.onInputDown.add(this.hitBoard, this);
        // 显示棋局信息
        let style = { font: "20px bold Arial", fill: "#567" };
        this.cur_piece = game.add.image(100, 100, game.id2piece[0]);
        this.cur_piece.width = game.piece[0].width * 0.5;
        this.cur_piece.height = game.piece[0].height * 0.5;
        this.game_live = game.add.text(10, 100, "", style);

        this.newGame();
    },

    newGame: function () {
        this.cur_player_is_ai = false;
        this.game_over = false; 
        this.winner = 2;
        this.cur_player = 0;
        this.hasChosen = false; // // 移动棋分两步：选择一个棋，再点击下一合法位置。初始未选择棋
        this.chosenX = 0;
        this.chosenY = 0;
        
        this.board_state = [[1, 1, 0, 0], [1, 2, 2, 0], [1, 2, 2, 0], [1, 1, 0, 0]]; //棋盘状态：2-空位置
        // this.board_state = [[2, 1, 0, 2], [2, 1, 1, 2], [2, 2, 2, 2], [2, 2, 2, 1]]; //棋盘状态：2-空位置
        this.cnt = [0, 0]; // 剩余的两方子的个数
        for(let i = 0; i < 4; i++)
            for(let j = 0; j < 4; j++){
                this.cnt[0] += this.board_state[i][j] === 0;
                this.cnt[1] += this.board_state[i][j] === 1;
            }

        this.point_piece = [[null, null, null, null], [null, null, null, null],
        [null, null, null, null], [null, null, null, null]];// 每个位置记录其指向的子的图片对象
        // 生成棋子的图片对象
        let getPiece = function (which, x, y) {
            let piece = this.pieces[which].getFirstExists(false, true,
                x * game.grid_size + game.board_pos[0], y * game.grid_size + game.board_pos[1], game.id2piece[which]);
            piece.width = 0.85 * game.piece[which].width;
            piece.height = 0.85 * game.piece[which].height;
            piece.anchor.setTo(0.5, 0.5);
            piece.which = which;
            return piece;
        }
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (this.board_state[i][j] !== game.blank)
                    this.point_piece[i][j] = getPiece.call(this, this.board_state[i][j], i, j);
            }
        }
        this.updateLive();
    },

    updateLive: function(){
        
        let live_text = "当前执子：    " + "剩余棋子：" + game.id2name[0] + "-" + this.cnt[0] + "  "+game.id2name[1]+"-" + this.cnt[1];
        this.game_live.text = live_text;
        this.cur_piece.loadTexture(game.id2piece[this.cur_player]);
        this.cur_piece.width = game.piece[this.cur_player].width*0.5;
        this.cur_piece.height = game.piece[this.cur_player].height*0.5;

    },

    hitBoard: function (board, hit) {
        this.board.inputEnabled = false;
        let rel_x = hit.clientX - game.board_pos[0], rel_y = hit.clientY - game.board_pos[1];
        let x = rel_x / game.grid_size, y = rel_y / game.grid_size;
        x = game.utils.toCloseInt(x);
        y = game.utils.toCloseInt(y);

        if (Math.abs(rel_x - x * game.grid_size) < 20 && Math.abs(rel_y - y * game.grid_size) < 20) {
            this.updateGame(x, y);
        } else {
            this.piece_box.visible = false;
            this.hasChosen = false;
        }
        this.board.inputEnabled = true;
    },

    aiTrun: function(){
        this.board.inputEnabled = false;        
        if (game.ism2p && this.game_over === false && this.cur_player_is_ai) {
            let ai_chosen = this.ai();
            // ai也分两步走：选择哪个子；走哪步。这样做是为了重用updateGame的代码
            this.updateGame(ai_chosen[0], ai_chosen[1]);
            game.utils.sleep(1000).then(() => {
                console.log('dayinchulai');
                // 在这时发生之前，点击了重新开始怎么办？
                this.updateGame(ai_chosen[2], ai_chosen[3]);
                this.board.inputEnabled = true;
            });
        }
    },

    ai: function(){
        // 针对棋盘状态board_state，返回玩家player的所有走法
        let getAllMove = function(board_state, player){
            let move = [];
            for(let i = 0; i < 4; i++){
                for(let j = 0; j < 4; j++){
                    if(board_state[i][j] === player){
                        for(let tmp of this.getMove(i, j, board_state)){
                            move.push([i, j, tmp[0], tmp[1]]);
                        }
                    }
                }
            }
            return move;
        };
        // 根据移动的子（由move指示），以及被吃掉的子，返回新的棋盘状态
        let getNextBoardState = function(move, eaten, board_state){
            let next = game.utils.copyArray(board_state);
            next[move[2]][move[3]] = next[move[0]][move[1]];
            next[move[0]][move[1]] = game.blank;
            for(let tmp of eaten)
                next[tmp[0]][tmp[1]] = game.blank;
            return next;
        };
        // 对于当前局势，返回对player的打分（越高，越有利）
        let evalScore = function(cur_board, start_board, player){
            let cnt = [0, 0];
            let other = 1 - player;
            for(let i = 0; i < 4; i++){
                for(let j = 0; j < 4; j++){
                    cnt[player] += cur_board[i][j] === player;
                    cnt[other] += cur_board[i][j] === other;
                }
            }
            return cnt[player] - cnt[other];
        };
        // 极大极小搜索+alpha-beta剪枝
        let max_depth = 6;
        let inf = 10000000;

        let minmax = function (board_state, cur_player, isMe, depth, alpha, beta) {
            // console.log(alpha, beta);
            calltime += 1;
            if (depth === 0) {
                return evalScore(board_state, this.board_state, this.cur_player);
            }
            let move = getAllMove.call(this, board_state, cur_player);
            let other = 1 - cur_player;
            let result, tmpv, value;
            if (isMe) {
                // 我方进行极大搜索
                value = -inf;
                for (let tmp of move) {
                    result = this.getNextStatus(...tmp, board_state, cur_player);
                    if (result.game_over) {
                        value = inf;
                        if (depth === max_depth) 
                            ai_choose = tmp;
                    } else {
                        tmpv = minmax.call(this, getNextBoardState(tmp, result.eaten, board_state), other, false, depth - 1, alpha, beta);
                        if (value <= tmpv) {
                            value = tmpv;
                            if (depth === max_depth) 
                                ai_choose = tmp;
                        }
                    }
                    alpha = Math.max(alpha, value);
                    // if(alpha >= beta)
                    //     break;
                }
            } else {
                // 对方进行极小搜索
                value = inf;
                for (let tmp of move) {
                    result = this.getNextStatus(...tmp, board_state, cur_player);
                    if (result.game_over) {
                        value = -inf;
                    } else {
                        tmpv = minmax.call(this, getNextBoardState(tmp, result.eaten, board_state), other, true, depth - 1, alpha, beta);
                        value = Math.min(value, tmpv);
                    }
                    beta = Math.min(beta, value);
                    // if(alpha >= beta)
                    //     break;
                }
            }
            return value;            
        };
        let ai_choose; // 将在极大极小搜索中被赋值
        let calltime = 0; // debug
        let tmp_board = game.utils.copyArray(this.board_state); //debug
        let tmp_cur = this.cur_player;
        let score = minmax.call(this, this.board_state, this.cur_player, true, max_depth, -inf, inf);
        console.log('棋盘状态是否改变：', game.utils.isSame(tmp_board, this.board_state), tmp_cur === this.cur_player); //debug
        console.log('ai的选择', {calltime, score, ai_choose});
        return ai_choose;
    },

    updateGame: function(x, y){
        // 更新棋盘的状态：包括装饰框的显示与隐藏、子的移动、子被吃
        let place_x = game.board_pos[0] + x*game.grid_size, 
            place_y = game.board_pos[1] + y*game.grid_size;
        if(this.hasChosen === false){
            if(this.board_state[x][y] === this.cur_player){
                this.piece_box.reset(place_x, place_y);
                this.hasChosen = true;
                this.chosenX = x;
                this.chosenY = y;

            }else{
                // 按了对方的子、空交叉点
                this.piece_box.visible = false;
            }
        }else{
            let lx = this.chosenX, ly = this.chosenY;
            if(this.board_state[x][y] === game.blank && Math.abs(x-lx)+Math.abs(y-ly)===1){
                // 合法的下法
                this.piece_box.reset(place_x, place_y);
                this.piece_box.visible = false;
                this.hasChosen = false;

                // 棋子移动得到的结果：结束与否，被吃掉的子的位置
                let result = this.getNextStatus(lx, ly, x, y, this.board_state, this.cur_player);

                // 将棋子移动
                game.add.tween(this.point_piece[lx][ly]).to({ x: place_x, y: place_y }, 200, Phaser.Easing.Power4, true).onComplete.add(
                    function () {
                        console.log('移动完成');
                        this.point_piece[x][y] = this.point_piece[lx][ly];
                        this.point_piece[lx][ly] = null;
                        this.board_state[x][y] = this.cur_player;
                        this.board_state[lx][ly] = game.blank;
                        // 回收将被吃掉的子
                        let id = this.cur_player;
                        for (let pos of result.eaten) {
                            console.log('kill:', pos);
                            this.cnt[this.board_state[pos[0]][pos[1]]] -= 1;
                            this.board_state[pos[0]][pos[1]] = game.blank;
                            let lose = game.add.tween(this.point_piece[pos[0]][pos[1]]).to({ x: game.outx[id], y: game.outy[id] }, 1000, Phaser.Easing.Bounce.Out, true);
                            lose.onComplete.add(function () {
                                this.out_pieces.push(this.point_piece[pos[0]][pos[1]]);
                                this.point_piece[pos[0]][pos[1]] = null;
                            }, this);
                        }
                        // 换对方下子
                        this.cur_player = 1 - this.cur_player;
                        // 更新棋局
                        this.updateLive();
                        // 如果结束，则结束游戏
                        if (result.game_over) {
                            this.winner = 1 - this.cur_player;
                            this.gameOver();
                        }
                        if (game.ism2p && this.cur_player_is_ai === false) {
                            this.cur_player_is_ai = true;
                            this.aiTrun();
                        }else if(game.ism2p && this.cur_player_is_ai === true){
                            this.cur_player_is_ai = false;
                        }
                        
                    }, this
                );
            } else if(this.board_state[x][y] === this.cur_player){
                // 选中要下的子之后，又点击了自己的子，则将后者作为要下的子
                this.piece_box.reset(place_x, place_y);
                this.chosenX = x;
                this.chosenY = y;            
            } else{
                // 选中了对方的棋，或者无法一步达到的空位置
                this.piece_box.visible = false;
                this.hasChosen = false;
            }
        }
    },

    getNextStatus: function(lx, ly, x, y, board_state, cur_player){
        // 根据cur_player在棋盘下子(lx,ly)->(x,y)后，返回棋局是否结束、以及被吃的子
        
        // 先把棋子移动
        board_state[x][y] = board_state[lx][ly];
        board_state[lx][ly] = game.blank;

        let other = 1-cur_player;
        let game_over = true;
        let eaten = [];

        // 先统计双方的棋子数目
        let cnt = [0, 0];
        for(let i = 0; i < 4; i++){
            for(let j = 0; j < 4; j++){
                cnt[cur_player] += board_state[i][j] === cur_player;
                cnt[other] += board_state[i][j] === other;
            }
        }

        let s = ""+cur_player, t = ""+other, b = ""+game.blank;
        // 水平方向
        let hori = "";
        for (let i = 0; i < 4; i++)
            hori += board_state[i][y];
        // 垂直方向
        let vert = "";
        for (let i = 0; i < 4; i++)
            vert += board_state[x][i];
        // 吃子逻辑
        if(cnt[cur_player] === 1){
            // 我方只剩下一个子，则只能“挑担”
            // 两种打击姿势
            let hit = [b+t+s+t, t+s+t+b];
            let hit_idx = [[1,3],[0,2]];
            hit.forEach(function (p, i) {
                if (hori === p) {
                    eaten.push([hit_idx[i][0], y]);
                    eaten.push([hit_idx[i][1], y]);
                }
                if(vert === p){
                    eaten.push([x, hit_idx[i][0]]);
                    eaten.push([x, hit_idx[i][1]]);
                }
            });
        }else if(cnt[other] > 1){
            // 普通规则吃（对方子为1时不能吃）
            let hit = [b+s+s+t, s+s+t+b, b+t+s+s, t+s+s+b];
            let hit_idx = [3,2,1,0];
            hit.forEach(function(p, i){
                if(hori === p)
                    eaten.push([hit_idx[i], y]);
                if(vert === p)
                    eaten.push([x, hit_idx[i]]);

            });
        }

        // 置被吃的子为空
        for(let pos of eaten)
            board_state[pos[0]][pos[1]] = game.blank;
        // 结束逻辑
        // 1. 对方无可动之子，结束
        for(let i = 0; i < 4; i++){
            if(game_over === false) break;
            for(let j = 0; j < 4; j++){
                if(board_state[i][j] === other && this.getMove(i, j, board_state).length > 0){
                    game_over = false;
                    break;
                }
            }
        }
        // 2. 对方子数为0， 结束（这种情况可以发生，即对方最后两个子被一箭双雕）
        if(cnt[other] === eaten.length)
            game_over = true;
        
        //将移动及的棋子还原
        board_state[lx][ly] = board_state[x][y];
        board_state[x][y] = game.blank;
        for(let pos of eaten)
            board_state[pos[0]][pos[1]] = other;

        return {game_over, eaten};
    },

    onStartBtn: function () {
        this.clearOutPieces();
        game.state.start('start');
    },

    onReplayBtn: function () {
        console.log('重新开始');
        this.clearOutPieces();
        for(let i = 0; i < 4; i++){
            for(let j = 0; j < 4; j++){
                if(this.point_piece[i][j] !== null)
                    this.point_piece[i][j].kill();
            }
        }
        this.board.inputEnabled = true;
        this.piece_box.visible = false;
        this.newGame();
    },

    clearOutPieces: function(){
        this.out_pieces.forEach(function(p){
            p.kill();
        });
        this.out_pieces = [];
    },

    getMove: function(x, y, board){
        let move = []
        if(x > 0 && board[x-1][y] === game.blank)
            move.push([x-1, y]);
        if(y > 0 && board[x][y-1] === game.blank)
            move.push([x, y-1]);
        if(x < 3 && board[x+1][y] === game.blank)
            move.push([x+1, y]);
        if(y < 3 && board[x][y+1] === game.blank)
            move.push([x, y+1]);
        return move;
    },

    gameOver: function(){
        console.log("游戏结束！");
        this.game_over = true;
        this.board.inputEnabled = false;
        let live_text = "\n" + game.id2name[this.winner] + "胜利!";
        this.game_live.text += live_text;
    }
};


game.my_state.about = {
    create: function () {
        // 加载图片，并且让图片和屏幕大小一致
        let bg = game.add.image(0, 0, 'about');
        bg.width = game.width;
        bg.height = game.height;
        // 回到开始界面按钮
        game.add.button(10, 10, 'start_btn', this.onStartBtn, this);
    },

    onStartBtn: function () {
        game.state.start('start');
    }
};

game.state.add('load', game.my_state.load);
game.state.add('start', game.my_state.start);
game.state.add('about', game.my_state.about);
game.state.add('play', game.my_state.play);
game.state.start('load');
