# evaluate_maze_solver.py - FIXED OBSERVATION SHAPE
import asyncio
import websockets
import json
import numpy as np
import time
from stable_baselines3 import PPO

# Load the trained maze solver
MODEL_PATH = "training/maze_solver/maze_model_1000"
model = PPO.load(MODEL_PATH)
print(f"🧩 Loaded maze solver: {MODEL_PATH}")

class EvaluationState:
    def __init__(self):
        self.active_connection = None
        self.game_ready = False
        self.command_queue = asyncio.Queue()
        self.result_queue = asyncio.Queue()
        
eval_state = EvaluationState()

def process_observation(raw_obs, step_count=0):
    """Convert 9D game observation to 11D model observation"""
    base_obs = np.array(raw_obs, dtype=np.float32)
    
    # Enhanced observation processing (matches training)
    enhanced_obs = np.zeros(11, dtype=np.float32)
    enhanced_obs[:9] = base_obs  # Original 9 features
    
    # Add normalized step count
    enhanced_obs[9] = min(step_count / 1000.0, 1.0)
    
    # Add success history (default to 0)
    enhanced_obs[10] = 0.0
    
    return enhanced_obs

async def handler(websocket):
    eval_state.active_connection = websocket
    print(">>> Maze environment connected!")
    
    try:
        ready_message = await websocket.recv()
        if json.loads(ready_message).get('type') == 'game_ready':
            eval_state.game_ready = True
            print("✅ Maze ready for evaluation!")

        async for message in websocket:
            data = json.loads(message)
            if 'observation' in data:
                await eval_state.result_queue.put(data)
                
    except Exception as e:
        print(f"WebSocket error: {e}")

async def command_sender():
    while True:
        command = await eval_state.command_queue.get()
        if eval_state.active_connection and eval_state.game_ready:
            try:
                await eval_state.active_connection.send(json.dumps(command))
            except:
                await eval_state.command_queue.put(command)
                await asyncio.sleep(1)

async def run_evaluation():
    """Comprehensive maze evaluation"""
    while not eval_state.game_ready:
        await asyncio.sleep(1)
    
    print("🎯 Starting maze evaluation...")
    
    success_count = 0
    total_steps = 0
    total_reward = 0
    
    for episode in range(10):  # More episodes for better evaluation
        print(f"\n🧭 EPISODE {episode + 1}/10")
        
        # Reset environment
        await eval_state.command_queue.put({"type": "reset"})
        reset_data = await eval_state.result_queue.get()
        
        # Process observation to match training format
        raw_obs = reset_data['observation']
        obs = process_observation(raw_obs, step_count=0)
        done = reset_data['done']
        episode_steps = 0
        episode_reward = 0
        start_time = time.time()
        
        # Run episode
        while not done and episode_steps < 1500:
            action, _ = model.predict(obs, deterministic=True)
            
            await eval_state.command_queue.put({"type": "step", "action": int(action)})
            step_data = await eval_state.result_queue.get()
            
            # Process observation for next step
            raw_obs = step_data['observation']
            obs = process_observation(raw_obs, step_count=episode_steps)
            reward = step_data['reward']
            done = step_data['done']
            info = step_data.get('info', {})
            
            episode_reward += reward
            episode_steps += 1
            
            # Progress indicator
            if episode_steps % 200 == 0:
                distance = info.get('distance_to_goal', 0)
                print(f"   Step {episode_steps}, Distance: {distance:.1f}")
        
        # Episode results
        elapsed = time.time() - start_time
        success = info.get('goal_reached', False)
        
        if success:
            success_count += 1
            print(f"   ✅ SUCCESS: {episode_steps} steps, {elapsed:.1f}s, Reward: {episode_reward:.1f}")
        else:
            print(f"   ❌ FAILED: {episode_steps} steps, {elapsed:.1f}s, Reward: {episode_reward:.1f}")
        
        total_steps += episode_steps
        total_reward += episode_reward
        
        await asyncio.sleep(1)  # Brief pause between episodes
    
    # Final evaluation summary
    print(f"\n" + "="*50)
    print("📊 MAZE SOLVER EVALUATION RESULTS")
    print("="*50)
    print(f"Success Rate: {success_count}/10 ({success_count/10:.1%})")
    print(f"Average Steps: {total_steps/10:.0f}")
    print(f"Average Reward: {total_reward/10:.1f}")
    print(f"Model: {MODEL_PATH}")
    print("="*50)

async def main():
    asyncio.create_task(command_sender())
    server = await websockets.serve(handler, "localhost", 8765)
    print(">>> Maze evaluation server started on localhost:8765")
    print(">>> Open your maze environment in the browser...")
    
    await run_evaluation()
    
    print("\n✅ Evaluation complete!")

if __name__ == "__main__":
    asyncio.run(main())