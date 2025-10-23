# train_maze_solver_enhanced.py - WITH WALL DETECTION & RESUME CAPABILITY
import asyncio
import websockets
import json
import numpy as np
import os
import gymnasium as gym
from gymnasium.spaces import Box, Discrete
import threading
import time
import datetime
import sys

from stable_baselines3 import PPO
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.vec_env import DummyVecEnv

# --- Paths for the enhanced model ---
CHECKPOINT_DIR = "training/maze_solver_enhanced/"
LOG_DIR = "training/logs/maze_solver_enhanced/"
os.makedirs(CHECKPOINT_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

# Create log file with timestamp
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = f"training/logs/maze_solver_enhanced/training_{timestamp}.txt"
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

class DualLogger:
    """Log to both console and file"""
    def __init__(self, filename):
        self.console = sys.stdout
        self.file = open(filename, 'w', encoding='utf-8')
        
    def write(self, message):
        self.console.write(message)
        self.file.write(message)
        self.file.flush()
        
    def flush(self):
        self.console.flush()
        self.file.flush()

# Redirect stdout to both console and file
sys.stdout = DualLogger(LOG_FILE)

print(f" ENHANCED MAZE SOLVER TRAINING (WITH WALL DETECTION & RESUME)")
print(f" Training started at {timestamp}")
print(f" Log file: {LOG_FILE}")

class TrainingState:
    def __init__(self):
        self.active_connection = None
        self.game_ready = False
        self.training_paused = False
        self.remaining_timesteps = 20000
        self.last_checkpoint = None
        self.command_queue = asyncio.Queue()
        self.result_queue = asyncio.Queue()
        self.reconnect_event = asyncio.Event()

training_state = TrainingState()

class EnhancedMazeEnv(gym.Env):
    """ Gym environment for the enhanced maze with 16D observation space. """
    def __init__(self, loop):
        super().__init__()
        self.loop = loop
        self.action_space = Discrete(7)
        self.observation_space = Box(low=-1.0, high=1.0, shape=(16,), dtype=np.float32)

    def _send_command_and_wait(self, command):
        async def _send_async():
            await training_state.command_queue.put(command)
            return await training_state.result_queue.get()
        
        future = asyncio.run_coroutine_threadsafe(_send_async(), self.loop)
        return future.result()

    def reset(self, seed=None, options=None):
        while training_state.training_paused:
            time.sleep(0.5)
        result = self._send_command_and_wait({"type": "reset"})
        obs = np.array(result['observation'], dtype=np.float32)
        return obs, {}

    def step(self, action):
        while training_state.training_paused:
            time.sleep(0.5)
        result = self._send_command_and_wait({"type": "step", "action": int(action)})
        obs = np.array(result['observation'], dtype=np.float32)
        reward = result['reward']
        terminated = result['done']
        info = result.get('info', {})
        return obs, reward, terminated, False, info

class MazeTrainingCallback(BaseCallback):
    def __init__(self, check_freq, save_path, verbose=0):
        super().__init__(verbose)
        self.check_freq = check_freq
        self.save_path = save_path
        self.episode_successes = []
        
    def _on_step(self):
        if self.num_timesteps > 0 and self.num_timesteps % self.check_freq == 0:
            total_steps = self.model.num_timesteps + (20000 - training_state.remaining_timesteps)
            path = os.path.join(self.save_path, f"maze_model_enhanced_{total_steps}")
            self.model.save(path)
            training_state.last_checkpoint = path
            
            if len(self.episode_successes) > 0:
                success_rate = np.mean(self.episode_successes[-20:])
                print(f"💾 Checkpoint: {total_steps}/20000 | Success: {success_rate:.1%}")
                
        return True
    
    def _on_rollout_end(self):
        if hasattr(self.model, 'env'):
            try:
                infos = self.model.env.get_attr('info')
                if infos and infos[0] and infos[0][-1].get('goal_reached'):
                     self.episode_successes.append(1)
                else:
                     self.episode_successes.append(0)
            except:
                pass

async def handler(websocket):
    training_state.active_connection = websocket
    training_state.training_paused = False
    print(">>> Enhanced maze environment connected!")
    
    try:
        ready_message = await websocket.recv()
        if json.loads(ready_message).get('type') == 'game_ready':
            training_state.game_ready = True
            print(" Maze ready! Training active.")
            training_state.reconnect_event.set()
        
        async for message in websocket:
            data = json.loads(message)
            if 'observation' in data:
                await training_state.result_queue.put(data)
            
    except websockets.exceptions.ConnectionClosed:
        print(" Game disconnected! Training paused...")
        training_state.training_paused = True
        training_state.game_ready = False
        training_state.active_connection = None
    except Exception as e:
        print(f"WebSocket error: {e}")
        training_state.training_paused = True
        training_state.game_ready = False
        training_state.active_connection = None

async def command_sender():
    while True:
        command = await training_state.command_queue.get()
        
        while training_state.training_paused or not training_state.game_ready:
            print("Waiting for game reconnection...")
            await training_state.reconnect_event.wait()
            training_state.reconnect_event.clear()
            
        if training_state.active_connection:
            try:
                await training_state.active_connection.send(json.dumps(command))
            except websockets.exceptions.ConnectionClosed:
                print(" Connection lost during send, requeuing command...")
                training_state.training_paused = True
                training_state.game_ready = False
                await training_state.command_queue.put(command)
                await asyncio.sleep(1)

def find_latest_checkpoint():
    if not os.path.exists(CHECKPOINT_DIR):
        return None, 0
    
    checkpoint_files = []
    for file in os.listdir(CHECKPOINT_DIR):
        if file.startswith("maze_model_enhanced_") and file.endswith(".zip"):
            try:
                timesteps = int(file.split('_')[-1].split('.')[0])
                checkpoint_files.append((timesteps, file))
            except:
                continue
    
    if checkpoint_files:
        latest_timesteps, latest_file = max(checkpoint_files)
        model_path = os.path.join(CHECKPOINT_DIR, latest_file)
        print(f" Found checkpoint: {latest_file} ({latest_timesteps} timesteps)")
        return model_path, latest_timesteps
    
    return None, 0

def start_training(loop):
    print(" Checking for existing checkpoints...")
    latest_checkpoint, completed_timesteps = find_latest_checkpoint()
    
    print(" Waiting for initial game connection...")
    while not training_state.game_ready:
        time.sleep(1)
    
    env = DummyVecEnv([lambda: Monitor(EnhancedMazeEnv(loop))])
    
    if latest_checkpoint:
        training_state.remaining_timesteps = 20000 - completed_timesteps
        if training_state.remaining_timesteps <= 0:
            print(" Training already completed.")
            return

        print(f" RESUMING from checkpoint: {completed_timesteps}/20000 timesteps")
        print(f" Loading model: {latest_checkpoint}")
        model = PPO.load(latest_checkpoint, env=env)
    else:
        training_state.remaining_timesteps = 20000
        print(" Starting NEW training...")
        model = PPO(
            "MlpPolicy",
            env,
            verbose=1,
            tensorboard_log=LOG_DIR,
            device="cpu",
            n_steps=2048,
            learning_rate=0.0001,
            batch_size=64,
            gamma=0.995,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.005,
            n_epochs=10,
            max_grad_norm=0.5,
        )
    
    callback = MazeTrainingCallback(
        check_freq=2000,
        save_path=CHECKPOINT_DIR,
        verbose=0
    )

    print(f" Training for {training_state.remaining_timesteps} timesteps...")
    print(" Stable-baselines3 progress reports will show below:")
    print("-" * 50)
    
    try:
        model.learn(
            total_timesteps=training_state.remaining_timesteps, 
            callback=callback,
            reset_num_timesteps=False
        )
        model.save(os.path.join(CHECKPOINT_DIR, "maze_solver_enhanced_final"))
    except Exception as e:
        print(f" Training error: {e}")
        import traceback
        traceback.print_exc()

    if training_state.training_paused:
        print(" Training paused due to disconnection.")
        print(" Just refresh the game tab to resume automatically!")
    else:
        print("\n" + "="*50)
        print(" ENHANCED MAZE SOLVER TRAINING COMPLETED!")
        print("="*50)

async def main():
    asyncio.create_task(command_sender())
    server = await websockets.serve(handler, "localhost", 8765)
    print(">>> Enhanced training server started on localhost:8765")
    
    loop = asyncio.get_event_loop()
    training_thread = threading.Thread(target=lambda: start_training(loop))
    training_thread.daemon = True
    training_thread.start()
    
    await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n>>> Training interrupted by user.")
    finally:
        if isinstance(sys.stdout, DualLogger):
            sys.stdout.file.close()
            sys.stdout = sys.stdout.console

