from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, List, Dict
import hashlib
import os
from datetime import datetime

class Database:
    def __init__(self, mongo_uri: str = None):
        """
        Initialise la connexion MongoDB
        Par défaut, utilise localhost ou la variable d'environnement MONGO_URI
        """
        self.mongo_uri = mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = AsyncIOMotorClient(self.mongo_uri)
        self.db = self.client["pathmind"]
        
        # Collections
        self.users = self.db["users"]
        self.levels = self.db["levels"]
        self.leaderboard = self.db["leaderboard"]
        
        print(f"📦 Connexion MongoDB: {self.mongo_uri}")
    
    # ===== UTILISATEURS =====
    async def create_user(self, username: str, password: str) -> Dict:
        """Créer un nouvel utilisateur"""
        # Vérifier si l'utilisateur existe
        existing = await self.users.find_one({"username": username})
        if existing:
            return {"success": False, "message": "Ce nom d'utilisateur existe déjà"}
        
        # Hasher le mot de passe
        password_hash = self._hash_password(password)
        
        # Créer l'utilisateur
        user_doc = {
            "username": username,
            "password_hash": password_hash,
            "created_at": datetime.utcnow(),
            "total_gold": 0,
            "levels_completed": 0,
            "current_level": 1
        }
        
        result = await self.users.insert_one(user_doc)
        
        return {
            "success": True,
            "user": {
                "id": str(result.inserted_id),
                "username": username,
                "total_gold": 0,
                "levels_completed": 0,
                "current_level": 1
            }
        }
    
    async def verify_user(self, username: str, password: str) -> Dict:
        """Vérifier les identifiants d'un utilisateur"""
        user = await self.users.find_one({"username": username})
        
        if not user:
            return {"success": False, "message": "Utilisateur non trouvé"}
        
        password_hash = self._hash_password(password)
        
        if user["password_hash"] != password_hash:
            return {"success": False, "message": "Mot de passe incorrect"}
        
        return {
            "success": True,
            "user": {
                "id": str(user["_id"]),
                "username": user["username"],
                "total_gold": user.get("total_gold", 0),
                "levels_completed": user.get("levels_completed", 0),
                "current_level": user.get("current_level", 1)
            }
        }
    
    async def update_user_gold(self, username: str, gold_collected: int) -> bool:
        """Mettre à jour le total de gold d'un utilisateur"""
        result = await self.users.update_one(
            {"username": username},
            {
                "$inc": {
                    "total_gold": gold_collected,
                    "levels_completed": 1
                }
            }
        )
        return result.modified_count > 0
    
    async def update_user_level(self, username: str, level: int) -> bool:
        """Mettre à jour le niveau actuel d'un utilisateur"""
        result = await self.users.update_one(
            {"username": username},
            {"$set": {"current_level": level}}
        )
        return result.modified_count > 0
    
    def _hash_password(self, password: str) -> str:
        """Hash simple du mot de passe avec SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    # ===== LEADERBOARD =====
    async def get_leaderboard(self, limit: int = 50) -> List[Dict]:
        """Récupérer le classement des joueurs par gold"""
        cursor = self.users.find(
            {},
            {"username": 1, "total_gold": 1, "levels_completed": 1}
        ).sort("total_gold", -1).limit(limit)
        
        leaderboard = []
        async for user in cursor:
            leaderboard.append({
                "username": user["username"],
                "total_gold": user.get("total_gold", 0),
                "levels_completed": user.get("levels_completed", 0)
            })
        
        return leaderboard
    
    # ===== NIVEAUX =====
    async def save_level(self, level_data: Dict) -> bool:
        """Sauvegarder un niveau"""
        level_num = level_data.get("level", 1)
        
        # Upsert: mettre à jour si existe, sinon créer
        result = await self.levels.update_one(
            {"level": level_num},
            {"$set": level_data},
            upsert=True
        )
        
        return result.acknowledged
    
    async def get_level(self, level_num: int) -> Optional[Dict]:
        """Récupérer un niveau par son numéro"""
        level = await self.levels.find_one({"level": level_num})
        
        if level:
            level["_id"] = str(level["_id"])
        
        return level
    
    async def get_all_levels(self) -> List[Dict]:
        """Récupérer tous les niveaux"""
        cursor = self.levels.find({}).sort("level", 1)
        
        levels = []
        async for level in cursor:
            level["_id"] = str(level["_id"])
            levels.append(level)
        
        return levels
    
    async def delete_all_levels(self) -> int:
        """Supprimer tous les niveaux (pour régénération)"""
        result = await self.levels.delete_many({})
        return result.deleted_count
    
    # ===== UTILITAIRES =====
    async def init_indexes(self):
        """Créer les index pour de meilleures performances"""
        await self.users.create_index("username", unique=True)
        await self.users.create_index("total_gold")
        await self.levels.create_index("level", unique=True)
        print("✅ Index MongoDB créés")
    
    async def close(self):
        """Fermer la connexion"""
        self.client.close()
        print("👋 Connexion MongoDB fermée")


# ===== TEST =====
if __name__ == "__main__":
    import asyncio
    
    async def test():
        db = Database()
        await db.init_indexes()
        
        # Test création utilisateur
        result = await db.create_user("test_player", "password123")
        print(f"Création utilisateur: {result}")
        
        # Test connexion
        result = await db.verify_user("test_player", "password123")
        print(f"Connexion: {result}")
        
        # Test leaderboard
        leaderboard = await db.get_leaderboard()
        print(f"Leaderboard: {leaderboard}")
        
        await db.close()
    
    asyncio.run(test())
