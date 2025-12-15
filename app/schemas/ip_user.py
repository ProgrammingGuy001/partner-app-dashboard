from pydantic import BaseModel

class IPUser(BaseModel):
    first_name:str 
    last_name:str
    phone_number:str
    is_verified:bool
    
class ApproveIPUser(IPUser):
    is_id_verified:bool
    