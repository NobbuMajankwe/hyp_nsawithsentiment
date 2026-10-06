
import { NavLink } from "react-router-dom";
import {
  AppBar,
  Button,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
//import { useAuth } from "./context/AuthContext";

export function Header() {
 
   const {logout } = useAuth();
  

  return (
    <>
      <AppBar position="static" sx={{ bgcolor: "#111827" }}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ mr: "auto" }}>
            NSA Research
          </Typography>
          <Stack direction="row" spacing={1} sx={{flexWrap:"wrap"}}>
            {[
              ["Dashboard", "/dashboard"],
              ["Datasets", "/datasets"],
              ["Run experiment", "/nsa"],
              ["Sentiment", "/sentiment"],
              ["Profile", "/profile"],
            ].map(([label, path]) => (
              <Button key={path} color="inherit" component={NavLink} to={path}>
                {label}
              </Button>
            ))}
            <Button color="inherit" onClick={logout}>
              Sign out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
    </>
  );
}
