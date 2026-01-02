from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import asyncio
import time
import os
from typing import Optional
from level_generator import LevelGenerator
from database import Database

# Initialisation
app = FastAPI(title="PathMind Game Server")
db = Database()
level_generator = LevelGenerator(grid_size=15)

# CORS - Configuration pour développement et production
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        FRONTEND_URL,  # URL de production depuis variable d'environnement
        "https://*.onrender.com"  # Tous les sous-domaines Render
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== MODÈLES =====
class UserCredentials(BaseModel):
    username: str
    password: str

# ===== ROUTES API =====
@app.get("/")
async def root():
    return {"message": "PathMind Game Server is running", "version": "1.0"}

@app.post("/api/register")
async def register(credentials: UserCredentials):
    """Inscription d'un nouvel utilisateur"""
    result = await db.create_user(credentials.username, credentials.password)
    if result["success"]:
        return {"user": result["user"]}
    raise HTTPException(status_code=400, detail=result["message"])

@app.post("/api/login")
async def login(credentials: UserCredentials):
    """Connexion d'un utilisateur"""
    result = await db.verify_user(credentials.username, credentials.password)
    if result["success"]:
        return {"user": result["user"]}
    raise HTTPException(status_code=401, detail=result["message"])

@app.get("/api/leaderboard")
async def get_leaderboard():
    """Récupérer le classement global"""
    leaderboard = await db.get_leaderboard(limit=50)
    return {"leaderboard": leaderboard}

@app.get("/api/levels")
async def get_levels():
    """Récupérer tous les niveaux"""
    levels = await db.get_all_levels()
    return {"levels": levels, "count": len(levels)}

@app.post("/api/levels/generate")
async def generate_levels(count: int = 35, save: bool = True):
    """Générer des niveaux aléatoires"""
    levels = level_generator.generate_multiple_levels(count)
    if save:
        for level in levels:
            await db.save_level(level)
        # Sauvegarder aussi en JSON
        level_generator.save_levels_to_json(levels, "levels.json")
    return {"message": f"{count} niveaux générés", "levels": levels}

# ===== WEBSOCKET GAME =====
@app.websocket("/ws/game")
async def game_websocket(websocket: WebSocket):
    """WebSocket principal du jeu"""
    await websocket.accept()
    print("✅ Client connecté au jeu !")
    
    # État du jeu
    game_state = {
        "user_id": None,
        "username": None,
        "level": 1,
        "grid": None,
        "player_pos": None,
        "goal_pos": None,
        "time_left": 30.0,
        "collected_icy": 0,
        "collected_gold": 0,
        "total_icy": 0,
        "crystals_icy": [],
        "crystals_gold": [],
        "crystals_red": [],
        "game_over": False,
        "victory": False
    }
    
    last_timer_update = time.time()
    
    try:
        while True:
            try:
                # Attendre un message avec timeout pour le timer
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=0.1
                )
                
                action = data.get('action')
                
                # === INITIALISATION ===
                if action == 'init':
                    game_state["username"] = data.get('username')
                    game_state["user_id"] = data.get('user_id')
                    print(f"🎮 Joueur connecté: {game_state['username']}")
                    
                    # Charger ou générer le niveau
                    await load_level(websocket, game_state, 1)
                
                # === MOUVEMENT ===
                elif action == 'move':
                    if game_state["game_over"] or game_state["victory"]:
                        continue
                        
                    direction = data.get('direction')
                    await handle_move(websocket, game_state, direction, db)
                
                # === REJOUER ===
                elif action == 'restart':
                    game_state["game_over"] = False
                    game_state["victory"] = False
                    game_state["collected_icy"] = 0
                    game_state["collected_gold"] = 0
                    await load_level(websocket, game_state, game_state["level"])
                
                # === NIVEAU SUIVANT ===
                elif action == 'next_level':
                    game_state["game_over"] = False
                    game_state["victory"] = False
                    game_state["collected_icy"] = 0
                    game_state["collected_gold"] = 0
                    next_level = game_state["level"] + 1
                    if next_level > 35:
                        next_level = 1  # Recommencer
                    await load_level(websocket, game_state, next_level)
                    
            except asyncio.TimeoutError:
                # Mettre à jour le timer
                if game_state["grid"] is not None and not game_state["game_over"] and not game_state["victory"]:
                    current_time = time.time()
                    elapsed = current_time - last_timer_update
                    last_timer_update = current_time
                    
                    game_state["time_left"] -= elapsed
                    
                    if game_state["time_left"] <= 0:
                        game_state["time_left"] = 0
                        game_state["game_over"] = True
                        print("⏰ Temps écoulé ! Game Over")
                        await websocket.send_json({
                            "type": "game_over",
                            "time_left": 0,
                            "message": "Temps écoulé !"
                        })
                    else:
                        # Envoyer mise à jour timer toutes les 100ms
                        await websocket.send_json({
                            "type": "timer_update",
                            "time_left": game_state["time_left"]
                        })
                        
    except Exception as e:
        print(f"❌ Erreur WebSocket: {e}")
    finally:
        print("👋 Client déconnecté")


async def load_level(websocket: WebSocket, game_state: dict, level_num: int):
    """Charger un niveau"""
    # Essayer de charger depuis la DB ou générer
    level_data = await db.get_level(level_num)
    
    if not level_data:
        # Générer un nouveau niveau
        level_data = level_generator.generate_level(difficulty=min(level_num, 10))
        level_data["level"] = level_num
        await db.save_level(level_data)
    
    game_state["level"] = level_num
    game_state["grid"] = level_data["grid"]
    game_state["player_pos"] = level_data["player_pos"]
    game_state["goal_pos"] = level_data["goal_pos"]
    game_state["time_left"] = level_data.get("time_limit", 30.0)
    game_state["total_icy"] = level_data.get("total_icy", 0)
    game_state["crystals_icy"] = level_data.get("crystals_icy", [])
    game_state["crystals_gold"] = level_data.get("crystals_gold", [])
    game_state["crystals_red"] = level_data.get("crystals_red", [])
    game_state["collected_icy"] = 0
    game_state["collected_gold"] = 0
    game_state["game_over"] = False
    game_state["victory"] = False
    
    # Envoyer l'état initial
    await websocket.send_json({
        "type": "init",
        "grid": game_state["grid"],
        "player_pos": game_state["player_pos"],
        "goal_pos": game_state["goal_pos"],
        "time_left": game_state["time_left"],
        "level": game_state["level"],
        "total_icy": game_state["total_icy"],
        "collected_icy": 0,
        "collected_gold": 0
    })
    print(f"📤 Niveau {level_num} envoyé")


async def handle_move(websocket: WebSocket, game_state: dict, direction: str, db: Database):
    """Gérer le mouvement du joueur"""
    dx, dy = 0, 0
    if direction == 'up':
        dy = -1
    elif direction == 'down':
        dy = 1
    elif direction == 'left':
        dx = -1
    elif direction == 'right':
        dx = 1
    
    new_x = game_state["player_pos"][0] + dx
    new_y = game_state["player_pos"][1] + dy
    grid = game_state["grid"]
    
    # Vérifier les limites
    if not (0 <= new_x < len(grid[0]) and 0 <= new_y < len(grid)):
        return
    
    cell = grid[new_y][new_x]
    
    # Vérifier si c'est un mur (1, 2, 3)
    if cell in [1, 2, 3]:
        return
    
    # Vérifier si c'est le goal
    if [new_x, new_y] == game_state["goal_pos"]:
        if game_state["collected_icy"] >= game_state["total_icy"]:
            # VICTOIRE !
            game_state["victory"] = True
            game_state["player_pos"] = [new_x, new_y]
            
            # Sauvegarder les gold dans le leaderboard
            if game_state["username"]:
                await db.update_user_gold(
                    game_state["username"],
                    game_state["collected_gold"]
                )
            
            await websocket.send_json({
                "type": "victory",
                "message": f"Niveau {game_state['level']} terminé !",
                "total_gold": game_state["collected_gold"],
                "player_pos": game_state["player_pos"]
            })
            print(f"🎉 Victoire ! Gold: {game_state['collected_gold']}")
            return
        else:
            # Pas assez de cristaux icy
            await websocket.send_json({
                "type": "need_crystals",
                "message": f"Collectez tous les cristaux bleus ! ({game_state['collected_icy']}/{game_state['total_icy']})"
            })
            return
    
    # Déplacer le joueur
    game_state["player_pos"] = [new_x, new_y]
    
    # Vérifier collecte de cristaux
    if cell == 4:  # Crystal Gold
        game_state["collected_gold"] += 1
        grid[new_y][new_x] = 0  # Retirer le cristal
        print(f"🏆 Crystal Gold collecté ! Total: {game_state['collected_gold']}")
        await websocket.send_json({
            "type": "crystal_collected",
            "crystal_type": "gold",
            "collected_gold": game_state["collected_gold"],
            "player_pos": game_state["player_pos"],
            "grid": grid
        })
        
    elif cell == 5:  # Crystal Icy (obligatoire)
        game_state["collected_icy"] += 1
        grid[new_y][new_x] = 0  # Retirer le cristal
        print(f"💎 Crystal Icy collecté ! {game_state['collected_icy']}/{game_state['total_icy']}")
        await websocket.send_json({
            "type": "crystal_collected",
            "crystal_type": "icy",
            "collected_icy": game_state["collected_icy"],
            "total_icy": game_state["total_icy"],
            "player_pos": game_state["player_pos"],
            "grid": grid
        })
        
    elif cell == 6:  # Crystal Red (malus)
        game_state["time_left"] -= 3.0
        grid[new_y][new_x] = 0  # Retirer le cristal
        print(f"⚠️ Crystal Red ! -3 secondes. Temps restant: {game_state['time_left']:.1f}s")
        
        if game_state["time_left"] <= 0:
            game_state["time_left"] = 0
            game_state["game_over"] = True
            await websocket.send_json({
                "type": "game_over",
                "time_left": 0,
                "message": "Le cristal rouge vous a fait perdre !"
            })
            return
            
        await websocket.send_json({
            "type": "crystal_collected",
            "crystal_type": "red",
            "time_left": game_state["time_left"],
            "player_pos": game_state["player_pos"],
            "grid": grid,
            "message": "-3 secondes !"
        })
    else:
        # Mouvement normal
        await websocket.send_json({
            "type": "update",
            "player_pos": game_state["player_pos"],
            "time_left": game_state["time_left"],
            "valid": True
        })


if __name__ == "__main__":
    import uvicorn
    # Utiliser le port dynamique de Render ou 8000 en local
    PORT = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=PORT)